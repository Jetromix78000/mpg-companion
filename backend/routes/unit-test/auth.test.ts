import express from "express";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";
import authRouter from "../auth.js";
import { User } from "../../models/User.js";

let mongoServer: MongoMemoryServer;
const app = express();
app.use(express.json());
app.use("/api/auth", authRouter);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  await User.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe("POST /api/auth/signup", () => {
  it("crée le compte et ouvre une session (passant)", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "nouveau@example.com", password: "password123" });

    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe("nouveau@example.com");
  });

  it("refuse un email déjà utilisé (non-passant)", async () => {
    await User.create({
      email: "existant@example.com",
      passwordHash: await bcrypt.hash("password123", 12),
      token: "token-existant",
    });

    const res = await request(app)
      .post("/api/auth/signup")
      .send({ email: "existant@example.com", password: "password123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe("Un compte existe déjà avec cet email");
  });
});

describe("POST /api/auth/signin", () => {
  it("connecte avec les bons identifiants (passant)", async () => {
    await User.create({
      email: "utilisateur@example.com",
      passwordHash: await bcrypt.hash("password123", 12),
      token: "token-initial",
    });

    const res = await request(app)
      .post("/api/auth/signin")
      .send({ email: "utilisateur@example.com", password: "password123" });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("refuse un mauvais mot de passe (non-passant)", async () => {
    await User.create({
      email: "utilisateur@example.com",
      passwordHash: await bcrypt.hash("password123", 12),
      token: "token-initial",
    });

    const res = await request(app)
      .post("/api/auth/signin")
      .send({ email: "utilisateur@example.com", password: "mauvais-mot-de-passe" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Email ou mot de passe incorrect");
  });
});
