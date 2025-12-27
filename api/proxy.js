import { NextResponse } from "next/server";

const ALLOWED = [
    "http://localhost:3000",
    "http://localhost:8081",
    "https://besideu.alimad.co"
];

export default function proxy(req) {
    const origin = req.headers.get("origin");
    const res = NextResponse.next();

    if (origin && ALLOWED.includes(origin)) {
        res.headers.set("Access-Control-Allow-Origin", origin);
        res.headers.set("Vary", "Origin");
        res.headers.set("Access-Control-Allow-Credentials", "true");
    }

    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return new NextResponse(null, { status: 204, headers: res.headers });
    }

    return res;
}

export const config = {
    matcher: "/api/:path*"
};
