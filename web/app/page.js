"use client";

import React from "react";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Users, MessageCircle, Heart, Loader2 } from "lucide-react";

export default function BesideUPage() {
  const [email, setEmail] = useState("");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [referrer, setReferrer] = useState("");
  const [openingWhatsApp, setOpeningWhatsApp] = useState(true);

  useEffect(() => {
    const savedEmail = localStorage.getItem("besideu_email");
    const savedStatus = localStorage.getItem("besideu_subscribed");

    if (savedEmail && savedStatus === "true") {
      setEmail(savedEmail);
      setIsSubscribed(true);
    }

    const params = new URLSearchParams(window.location.search);
    const ref = params.get("r") || "direct";
    setReferrer(ref);

    const userAgent = navigator.userAgent;
    let platform = "Unknown";
    if (userAgent.includes("Windows")) platform = "Windows";
    else if (userAgent.includes("Mac")) platform = "Mac";
    else if (userAgent.includes("Linux")) platform = "Linux";
    else if (userAgent.includes("Android")) platform = "Android";

    fetch("/api/log-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, referrer: ref }),
    }).catch((err) => console.error("Visit logging failed:", err));
  }, []);

  function openWhatsApp() {
    const url = `https://whatsapp.com/channel/0029Vb7KAt9KLaHsm5b68g2t`;
    setOpeningWhatsApp(true);
    try {
      window.open(url, "_blank");
    } catch (e) {
      window.location.href = url;
    }
    setTimeout(() => setOpeningWhatsApp(false), 1600);
  }

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      setMessage("Please enter a valid email address");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, referrer }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSubscribed(true);
        localStorage.setItem("besideu_email", email);
        localStorage.setItem("besideu_subscribed", "true");
        setMessage(
          "✓ Subscribed! You'll get notified when we launch in January 2026."
        );
      } else {
        setMessage(data.error || "Subscription failed. Please try again.");
      }
    } catch (error) {
      setMessage("Network error. Please try again.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {openingWhatsApp && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white font-bold">
          <a
            href="https://whatsapp.com/channel/0029Vb7KAt9KLaHsm5b68g2t"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpeningWhatsApp(false)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-green-600 text-white border-2 border-green-500"
          >
            Open WhatsApp
          </a>
        </div>
      )}
      <div className="min-h-screen bg-background text-foreground dark font-sans">
        <nav className="border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="text-2xl font-bold text-primary">BesideU</div>
            <a
              href="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden"
            >
              Admin
            </a>
          </div>
        </nav>
        <section className="max-w-7xl mx-auto px-4 py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="space-y-2">
                <h1 className="text-5xl font-bold text-balance leading-tight">
                  Connect Over the Internet,{" "}
                  <span className="text-primary">Physically</span>
                </h1>
                <p className="text-xl text-muted-foreground">
                  BesideU brings friends closer, both online and in the real
                  world.
                </p>
              </div>

              <p className="text-lg text-foreground/80">
                Through BesideU, you can chat, share statuses, and manage your
                friends-just like any other social app. But with a twist: the
                app gives you a sense of where your friends are nearby. It lets
                you know when friends are around so you can plan spontaneous
                meetups.
              </p>

              {/* Features */}
              <div className="grid grid-cols-2 gap-4 py-8 hidden">
                <div className="flex gap-3">
                  <MessageCircle className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Chat & Status</p>
                    <p className="text-sm text-muted-foreground">
                      Share moments instantly
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <MapPin className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Location Aware</p>
                    <p className="text-sm text-muted-foreground">
                      Find friends nearby
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Users className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Friend Requests</p>
                    <p className="text-sm text-muted-foreground">
                      Contacts-based management
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Heart className="w-6 h-6 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-semibold">Stay Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Never miss a moment
                    </p>
                  </div>
                </div>
              </div>

              {/* Subscription Form */}
              {!isSubscribed ? (
                <Card className="bg-card/50 border-border">
                  <CardHeader>
                    <CardTitle>Get Notified at Launch</CardTitle>
                    <CardDescription>January 2026</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubscribe} className="space-y-4">
                      <div className="grid grid-cols-1 gap-2">
                        <Input
                          type="email"
                          placeholder="example@gmail.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          disabled={isLoading}
                          className="grid-start-1"
                        />
                        <Button
                          type="submit"
                          disabled={isLoading}
                          className="bg-primary text-primary-foreground hover:bg-primary/90"
                        >
                          {isLoading ? "Subscribing..." : "Subscribe"}
                        </Button>
                      </div>
                      {message && (
                        <p
                          className={`text-sm ${
                            message.includes("✓")
                              ? "text-green-500"
                              : "text-destructive"
                          }`}
                        >
                          {message}
                        </p>
                      )}
                    </form>
                  </CardContent>
                </Card>
              ) : (
                <Card className="bg-card/50 border-green-500/50 bg-green-500/10 top-0">
                  <CardContent className="">
                    <p className="text-green-400">
                      ✓ You're subscribed! We'll notify {email} at launch.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right visual */}
            <div className="space-y-4">
              <Card className="bg-card/50 border-border p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Friends Nearby</p>
                      <p className="text-xs text-muted-foreground">
                        Real-time awareness
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pb-4 border-b border-border">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Instant Chat</p>
                      <p className="text-xs text-muted-foreground">
                        Connect anywhere
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">Spontaneous Meetups</p>
                      <p className="text-xs text-muted-foreground">
                        Plan on the go
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border bg-card/30 mt-20">
          <div className="max-w-7xl mx-auto px-4 py-12">
            <div className="grid grid-cols-3 gap-8">
              <div>
                <p className="font-semibold mb-2">Made by</p>
                <p className="text-muted-foreground">Muhammad Ali</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Founders</p>
                <p className="text-muted-foreground">Habeebullah & Aneeq</p>
              </div>
              <div>
                <p className="font-semibold mb-2">Expected Launch</p>
                <p className="text-muted-foreground">January 2026</p>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
