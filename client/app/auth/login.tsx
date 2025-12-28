import React, { useState } from 'react';
import { StyleSheet, TextInput, Alert, ActivityIndicator, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Link } from 'expo-router';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { auth, firebase, PhoneAuthProvider } from '@/utils/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function LoginScreen() {
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { signIn } = useAuth();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);

    const sendVerification = async () => {
        if (!phone) {
            Alert.alert('Error', 'Please enter a valid phone number');
            return;
        }
        setLoading(true);
        try {
            if (recaptchaVerifier.current && !(recaptchaVerifier.current as any)._reset) {
                (recaptchaVerifier.current as any)._reset = () => { };
            }

            const phoneProvider = new PhoneAuthProvider();
            const verificationId = await phoneProvider.verifyPhoneNumber(
                phone,
                recaptchaVerifier.current!
            );
            setVerificationId(verificationId);
            Alert.alert('Success', 'Verification code has been sent to your phone.');
        } catch (err: any) {
            Alert.alert('Error', err.message);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const confirmCode = async () => {
        if (!verificationCode || !verificationId) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }

        setLoading(true);
        try {
            const credential = firebase.auth.PhoneAuthProvider.credential(
                verificationId,
                verificationCode
            );
            const userCredential = await auth.signInWithCredential(credential);
            const idToken = await userCredential.user!.getIdToken();

            await signIn(idToken);
        } catch (err: any) {
            Alert.alert('Error', `Login failed: ${err.message}`);
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, justifyContent: 'center' }}
            >
                <FirebaseRecaptchaVerifierModal
                    ref={recaptchaVerifier}
                    firebaseConfig={firebase.app().options}
                />

                <View style={styles.content}>
                    <ThemedText type="title" style={styles.title}>Welcome Back</ThemedText>
                    <ThemedText style={styles.subtitle}>Sign in to continue</ThemedText>

                    {!verificationId ? (
                        <>
                            <ThemedText style={styles.label}>Phone Number</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="+1234567890"
                                placeholderTextColor="#888"
                                autoComplete="tel"
                                keyboardType="phone-pad"
                                textContentType="telephoneNumber"
                                onChangeText={setPhone}
                                value={phone}
                            />

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={sendVerification}
                                activeOpacity={0.8}
                            >
                                {loading ? <ActivityIndicator color="white" /> : (
                                    <ThemedText style={styles.primaryButtonText}>
                                        Send Verification Code
                                    </ThemedText>
                                )}
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <ThemedText style={styles.label}>Verification Code</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="123456"
                                placeholderTextColor="#888"
                                keyboardType="number-pad"
                                onChangeText={setVerificationCode}
                                value={verificationCode}
                            />

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={confirmCode}
                                activeOpacity={0.8}
                            >
                                {loading ? <ActivityIndicator color="white" /> : (
                                    <ThemedText style={styles.primaryButtonText}>
                                        Confirm Code
                                    </ThemedText>
                                )}
                            </TouchableOpacity>
                        </>
                    )}

                    <View style={styles.footer}>
                        <ThemedText>Don't have an account? </ThemedText>
                        <Link href="/auth/signup">
                            <ThemedText style={{ color: theme.tint, fontWeight: 'bold' }}>Sign Up</ThemedText>
                        </Link>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        justifyContent: 'center',
    },
    content: {
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
    },
    title: {
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        marginBottom: 30,
        textAlign: 'center',
        opacity: 0.7,
    },
    label: {
        marginBottom: 5,
        marginLeft: 5,
        fontWeight: '600',
    },
    input: {
        height: 50,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 15,
        marginBottom: 20,
        fontSize: 16,
    },
    primaryButton: {
        backgroundColor: '#000',
        height: 50,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    footer: {
        marginTop: 40,
        flexDirection: 'row',
        justifyContent: 'center',
    }
});
