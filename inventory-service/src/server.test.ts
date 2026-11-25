import assert from "node:assert/strict";
import { once } from "node:events";
import { test, type TestContext } from "node:test";
import { createApp } from "./server.ts";

const reservationRequest = { orderId: "ORD-100", productId: 1, quantity: 3 };

async function startServer(t: TestContext) {
    const server = createApp().listen(0, "127.0.0.1");
    t.after(() => server[Symbol.asyncDispose]());
    await once(server, "listening");

    const address = server.address();
    assert.ok(address && typeof address === "object");
    return `http://127.0.0.1:${address.port}`;
}

function postReservation(baseUrl: string, request: typeof reservationRequest) {
    return fetch(`${baseUrl}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(5000)
    });
}

async function getStock(baseUrl: string, productId: number) {
    const response = await fetch(`${baseUrl}/products/${productId}`, {
        signal: AbortSignal.timeout(5000)
    });
    assert.equal(response.status, 200);
    const product = await response.json();
    return product.availablequantity;
}

test("reserving 3 units returns 201 and reduces stock from 10 to 7", async t => {
    const baseUrl = await startServer(t);
    assert.equal(await getStock(baseUrl, 1), 10);

    const response = await postReservation(baseUrl, reservationRequest);
    assert.equal(response.status, 201);
    assert.equal(await getStock(baseUrl, 1), 7);
});

test("repeating the same reservation returns 200 and keeps stock at 7", async t => {
    const baseUrl = await startServer(t);
    const created = await postReservation(baseUrl, reservationRequest);
    assert.equal(created.status, 201);
    const reservation = await created.json();

    const retry = await postReservation(baseUrl, reservationRequest);
    assert.equal(retry.status, 200);
    assert.deepEqual(await retry.json(), reservation);
    assert.equal(await getStock(baseUrl, 1), 7);
});

test("changing the quantity for the same order and product returns 409 and keeps stock at 7", async t => {
    const baseUrl = await startServer(t);
    const created = await postReservation(baseUrl, reservationRequest);
    assert.equal(created.status, 201);

    const retry = await postReservation(baseUrl, { ...reservationRequest, quantity: 4 });
    assert.equal(retry.status, 409);
    assert.equal(await getStock(baseUrl, 1), 7);
});

test("a new order requesting 20 units returns 409 for insufficient inventory", async t => {
    const baseUrl = await startServer(t);
    const created = await postReservation(baseUrl, reservationRequest);
    assert.equal(created.status, 201);

    const response = await postReservation(baseUrl, { ...reservationRequest, orderId: "ORD-101", quantity: 20 });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "Insufficient inventory" });
    assert.equal(await getStock(baseUrl, 1), 7);
});

test("reserving an unknown product returns 404", async t => {
    const baseUrl = await startServer(t);

    const response = await postReservation(baseUrl, { ...reservationRequest, productId: 999 });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Product not found" });
});

test("reserving a negative quantity returns 400 and keeps stock at 10", async t => {
    const baseUrl = await startServer(t);

    const response = await postReservation(baseUrl, { ...reservationRequest, quantity: -1 });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "quantity must be a positive integer" });
    assert.equal(await getStock(baseUrl, 1), 10);
});
