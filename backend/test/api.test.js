import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { User } from "../src/models/User.js";
import { Track } from "../src/models/Track.js";

let server, base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test("health sans dépendre de MongoDB", async () => {
  const r = await fetch(base + "/api/health");
  assert.equal(r.status, 200);
  assert.equal((await r.json()).status, "ok");
});

test("schémas Mongoose et relation", () => {
  const u = new User({
    name: "Test",
    email: "TEST@example.com",
    password: "12345678",
  });

  assert.equal(u.email, "test@example.com");
  const t = new Track({
    ownerId: new mongoose.Types.ObjectId(),
    title: "Blues",
    originalName: "b.mp3",
    storedName: "x.mp3",
    mimeType: "audio/mpeg",
    size: 42,
  });
  
  assert.equal(t.title, "Blues");
  assert.equal(Track.schema.path("ownerId").options.ref, "User");
});

test("protection auth sur PUT /api/users/me/password et DELETE /api/users/me", async () => {
  const rPass = await fetch(base + "/api/users/me/password", { method: "PUT" });
  assert.equal(rPass.status, 401);

  const rDel = await fetch(base + "/api/users/me", { method: "DELETE" });
  assert.equal(rDel.status, 401);
});

test("sécurité : rejet 401 sans token JWT sur /api/tracks", async () => {
  const rGet = await fetch(base + "/api/tracks");
  assert.equal(rGet.status, 401);

  const rDelete = await fetch(base + "/api/tracks/fake-id", { method: "DELETE" });
  assert.equal(rDelete.status, 401);
});

test("sécurité : rejet 401 avec un JWT invalide", async () => {
  const r = await fetch(base + "/api/tracks", {
    headers: { Authorization: "Bearer token-invalide-ou-corrompu" },
  });
  assert.equal(r.status, 401);
  const data = await r.json();
  assert.equal(data.message, "Jeton invalide ou expiré");
});

test("contrat d'API : upload sans fichier audio retourne 400", async () => {
  // Génération d'un token valide pour tester Multer
  const jwt = await import("jsonwebtoken");
  const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
  const validToken = jwt.default.sign(
    { sub: new mongoose.Types.ObjectId().toString(), email: "tester@example.com" },
    SECRET,
  );

  const form = new FormData();
  form.append("title", "Track sans fichier audio");

  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${validToken}` },
    body: form,
  });

  assert.equal(r.status, 400);
  const data = await r.json();
  assert.equal(data.message, "Fichier audio requis");
});

test("contrat d'API : upload avec type MIME audio refusé retourne 400", async () => {
  const jwt = await import("jsonwebtoken");
  const SECRET = process.env.JWT_SECRET || "tp1-development-secret";
  const validToken = jwt.default.sign(
    { sub: new mongoose.Types.ObjectId().toString(), email: "tester@example.com" },
    SECRET,
  );

  const form = new FormData();
  form.append("title", "Fichier non supporté");
  const fakeFile = new Blob(["ceci n'est pas un fichier audio"], { type: "text/plain" });
  form.append("audio", fakeFile, "test.txt");

  const r = await fetch(base + "/api/tracks", {
    method: "POST",
    headers: { Authorization: `Bearer ${validToken}` },
    body: form,
  });

  assert.equal(r.status, 400);
  const data = await r.json();
  assert.equal(data.message, "Format audio non accepté");
});


