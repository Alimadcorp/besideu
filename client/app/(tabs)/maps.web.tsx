import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import React from "react";

export default function Map() {
  return (
    <ThemedView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ThemedText>Maps are only available on mobile.</ThemedText>
    </ThemedView>
  );
}
