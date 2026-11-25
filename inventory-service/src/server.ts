import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import express from "express";

type Product = {
    id: number;
    name: string;
    availablequantity: number;
};

type Reservation = {
    id: string;
    orderId: string;
    productId: number;
    quantity: number;
};

export function createApp() {
    const products: Product[] = [
        { id: 1, name: "Mechanical Keyboard", availablequantity: 10 },
        { id: 2, name: "Wireless Mouse", availablequantity: 25 },
        { id: 3, name: "Monitor", availablequantity: 5 }
    ];
    const reservations = new Map<string, Reservation>();

    const app = express();

    app.use(express.json());

    app.get("/health", (_req, res) => {
        res.json({
            status: "ok",
            service: "inventory-service"
        });
    });

    app.get("/products/:id", (req, res) => {
        const id = Number(req.params.id);
        const product = products.find(product => product.id === id);

        if (!product) {
            return res.status(404).end();
        }

        res.json(product);
    });

    app.post("/reservations", (req, res) => {
        const { orderId: rawOrderId, productId, quantity } = req.body ?? {};
        const orderId = typeof rawOrderId === "string" ? rawOrderId.trim() : "";

        if (orderId.length === 0) {
            return res.status(400).json({ error: "orderId must be a non-empty string" });
        }

        if (typeof productId !== "number" || !Number.isInteger(productId)) {
            return res.status(400).json({ error: "productId must be an integer" });
        }

        if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) {
            return res.status(400).json({ error: "quantity must be a positive integer" });
        }

        const product = products.find(product => product.id === productId);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }

        const reservationKey = JSON.stringify([orderId, productId]);
        const existingReservation = reservations.get(reservationKey);
        if (existingReservation) {
            if (existingReservation.quantity !== quantity) {
                return res.status(409).json({ error: "This order already reserved a different quantity of this product" });
            }

            return res.status(200).json(existingReservation);
        }

        if (quantity > product.availablequantity) {
            return res.status(409).json({ error: "Insufficient inventory" });
        }

        const reservation: Reservation = { id: randomUUID(), orderId, productId, quantity };
        reservations.set(reservationKey, reservation);
        product.availablequantity -= quantity;
        res.status(201).json(reservation);
    });

    return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    createApp().listen(3001, () => {
        console.log("Inventory Service running on port 3001");
    });
}
