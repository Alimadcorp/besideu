import { StyleSheet, View, TextInput, TouchableOpacity, Alert, Platform, Keyboard, KeyboardAvoidingView, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { apiRequest } from '@/utils/api';

const COLORS = ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#000000', '#FF69B4', '#00FFFF'];

export default function CreateStatusScreen() {
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const [text, setText] = useState('');
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [backgroundColor, setBackgroundColor] = useState(COLORS[7]); // Default black
    const [uploading, setUploading] = useState(false);

    // Scheduling
    const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handlePost = async () => {
        if (!text.trim() && !imageUri) return;

        setUploading(true);
        try {
            let uploadedUrl = null;
            if (imageUri) {
                const formData = new FormData();
                formData.append('image', {
                    uri: imageUri,
                    type: 'image/jpeg',
                    name: 'status.jpg',
                } as any);

                const uploadRes = await apiRequest('/v1/image/upload', {
                    method: 'POST',
                    body: formData,
                });
                uploadedUrl = uploadRes.url;
            }

            await apiRequest('/v1/status', {
                method: 'POST',
                body: JSON.stringify({
                    type: imageUri ? 'image' : 'text',
                    content: text,
                    media_url: uploadedUrl,
                    background_color: backgroundColor,
                    scheduled_at: scheduleDate ? scheduleDate.toISOString() : null,
                })
            });

            router.back();
        } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to post status');
        } finally {
            setUploading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.container, { backgroundColor: imageUri ? 'black' : backgroundColor }]}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
                    <IconSymbol name="xmark" size={28} color="white" />
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                    {!imageUri && (
                        <TouchableOpacity onPress={() => {
                            const idx = COLORS.indexOf(backgroundColor);
                            const next = (idx + 1) % COLORS.length;
                            setBackgroundColor(COLORS[next]);
                        }} style={styles.iconBtn}>
                            <IconSymbol name="pencil" size={24} color="white" />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={() => setShowDatePicker(true)} style={styles.iconBtn}>
                        <IconSymbol name="clock.fill" size={24} color={scheduleDate ? theme.tint : "white"} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content Preview */}
            <View style={styles.content}>
                {imageUri ? (
                    <Image source={{ uri: imageUri }} style={styles.previewImage} contentFit="contain" />
                ) : (
                    <TextInput
                        style={styles.textInput}
                        placeholder="Type a status..."
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        value={text}
                        onChangeText={setText}
                        multiline
                        autoFocus
                    />
                )}

                {/* Caption input for image */}
                {imageUri && (
                    <View style={styles.captionContainer}>
                        <TextInput
                            style={styles.captionInput}
                            placeholder="Add a caption..."
                            placeholderTextColor="rgba(255,255,255,0.8)"
                            value={text}
                            onChangeText={setText}
                        />
                    </View>
                )}
            </View>

            {/* Footer */}
            <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
                {/* Image Picker */}
                {!imageUri && (
                    <TouchableOpacity onPress={pickImage} style={styles.mediaBtn}>
                        <IconSymbol name="camera.fill" size={24} color="white" />
                    </TouchableOpacity>
                )}

                <View style={{ flex: 1 }} />

                <TouchableOpacity
                    onPress={handlePost}
                    disabled={uploading || (!text.trim() && !imageUri)}
                    style={[styles.sendBtn, { opacity: uploading || (!text.trim() && !imageUri) ? 0.5 : 1 }]}
                >
                    {uploading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <IconSymbol name="paperplane.fill" size={24} color="white" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Schedulers */}
            {showDatePicker && (
                <DateTimePicker
                    value={scheduleDate || new Date()}
                    mode="date"
                    minimumDate={new Date()}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        if (Platform.OS === 'android') setShowDatePicker(false);
                        if (date) {
                            if (Platform.OS === 'android') {
                                setScheduleDate(date);
                                setTimeout(() => setShowTimePicker(true), 100);
                            } else {
                                setShowDatePicker(false);
                                setShowTimePicker(true);
                                setScheduleDate(date);
                            }
                        }
                    }}
                />
            )}
            {showTimePicker && (
                <DateTimePicker
                    value={scheduleDate || new Date()}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                        setShowTimePicker(false);
                        if (date) {
                            setScheduleDate(date);
                            Alert.alert('Scheduled', `Status will be posted on ${date.toLocaleString()}`);
                        }
                    }}
                />
            )}

        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        zIndex: 10,
    },
    iconBtn: {
        padding: 5,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textInput: {
        fontSize: 40,
        color: 'white',
        textAlign: 'center',
        padding: 20,
        width: '100%',
        fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 20,
    },
    sendBtn: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaBtn: {
        width: 50,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 25,
    },
    captionContainer: {
        position: 'absolute',
        bottom: 80,
        width: '100%',
        paddingHorizontal: 20,
    },
    captionInput: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 10,
        fontSize: 16,
        textAlign: 'center',
    }
});
