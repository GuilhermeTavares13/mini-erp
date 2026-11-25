import { randomUUID } from "node:crypto";
import express, { type Response as ExpressResponse } from "express";

type OrderStatus = "PENDING" | "CONFIRMED" | "REJECTED";

type Order = {
    id: string;
    productId: number;
    quantity: number;
    status: OrderStatus;
};

const orders = new Map<string, Order>();
const INVENTORY_URL = process.env.INVENTORY_URL ?? "http://localhost:3001";
const INVENTORY_TIMEOUT_MS = 5_000;

async function reserveInventory(order: Order): Promise<Response> {
    return fetch(`${INVENTORY_URL}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderId: order.id,
            productId: order.productId,
            quantity: order.quantity
        }),
        signal: AbortSignal.timeout(INVENTORY_TIMEOUT_MS)
    });
}

async function respondToReservation(order: Order, res: ExpressResponse, successStatus: 200 | 201) {
    let reservation: Response;
    try {
        reservation = await reserveInventory(order);
    } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            return res.status(202).json({
                message: "Inventory response timed out. The order is pending and can be retried.",
                order
            });
        }

        return res.status(502).json({ error: "Inventory service unavailable", order });
    }

    void reservation.body?.cancel().catch(() => {});

    if (reservation.status === 200 || reservation.status === 201) {
        order.status = "CONFIRMED";
        return res.status(successStatus).json(order);
    }

    if (reservation.status === 404) {
        order.status = "REJECTED";
        return res.status(422).json({ error: "Product not found", order });
    }

    if (reservation.status === 409) {
        order.status = "REJECTED";
        return res.status(409).json({ error: "Insufficient inventory", order });
    }

    return res.status(202).json({
        message: "Inventory returned an unexpected response. The order is pending and can be retried.",
        order
    });
}

const app = express();

app.use(express.json());

app.post("/orders", (req, res) => {
    const { productId, quantity } = req.body ?? {};

    if (typeof productId !== "number" || !Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: "productId must be a positive integer" });
    }

    if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ error: "quantity must be a positive integer" });
    }

    const order: Order = { id: randomUUID(), productId, quantity, status: "PENDING" };
    orders.set(order.id, order);

    return respondToReservation(order, res, 201);
});

app.post("/orders/:id/retry", (req, res) => {
    const order = orders.get(req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "PENDING") {
        return res.json(order);
    }

    return respondToReservation(order, res, 200);
});

app.get("/orders/:id", (req, res) => {
    const order = orders.get(req.params.id);

    if (!order) {
        return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
});

app.listen(3002, () => {
    console.log("Orders Service running on port 3002");
});
