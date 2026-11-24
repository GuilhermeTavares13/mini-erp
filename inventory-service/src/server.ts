import express from "express";

type Product = {
    id: number;
    name: string;
    availableQuantity: number;
};

const products: Array<Product> = [
    {
        id: 1,
        name: 'Mechanical Keyboard',
        availableQuantity: 10
    },
    {
        id: 2,
        name: "Wireless Mouse",
        availableQuantity: 25
    },
    {
        id: 3,
        name: "Monitor",
        availableQuantity: 5
    }
];

const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        service: "inventory-service"
    });
});

app.get("/products/:id", (_req, res) => {
    const id = Number(_req.params.id);

    const result = products.filter(product => product.id === id);

    if (result.length === 0) {
        return res.status(404).json(result);
    }

    res.json(result);
});

app.post("/reservations", (_req, res) => {
    const { orderId, productId, quantity } = _req.body;

    const product = products.filter(product => product.id === productId);

    if (product.length === 0) {
        return res.status(404);
    }

    if (quantity < 0) {
        return res.status(409);
    }
});

app.listen(3001, () => {
    console.log("Inventory Service running on port 3001");
});