import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { StyleSheet, View } from 'react-native';
import React from "react";

export default function WebMaps() {
    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <ThemedText type="title">Nearby</ThemedText>
            </View>
            <View style={styles.emptyContainer}>
                <ThemedText>Maps are not supported on the web</ThemedText>
                <ThemedText style={styles.emptySubtext}>:&lt;</ThemedText>
            </View>
        </ThemedView>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptySubtext: {
        opacity: 0.6,
        textAlign: 'center',
        marginTop: 10,
    },
    emptyList: {
        flexGrow: 1,
    },
});
