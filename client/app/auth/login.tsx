import React, { useState } from 'react';
import { StyleSheet, TextInput, Alert, ActivityIndicator, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link } from 'expo-router';
import FirebaseRecaptchaVerifierModal, { FirebaseRecaptchaVerifier } from '@/components/FirebaseRecaptcha';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { auth, firebase, PhoneAuthProvider } from '@/utils/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { normalizePhoneNumber } from '@/utils/crypto';

export default function LoginScreen() {
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { signIn } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();

    const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifier>(null);

    const getErrorMessage = (err: any) => {
        const msg = err.message || String(err);
        if (msg.includes('invalid-phone-number')) return 'The phone number you entered is invalid.';
        if (msg.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
        if (msg.includes('invalid-verification-code')) return 'The code you entered is incorrect.';
        if (msg.includes('code-expired')) return 'The verification code has expired. Please request a new one.';
        if (msg.includes('User not found') || msg.includes('404')) return null;
        if (msg.includes('user-disabled')) return 'This account has been disabled.';
        if (msg.includes('network-request-failed')) return 'Connection error. Check your internet.';
        if (msg.includes('39') || msg.includes('auth/sms-quota-exceeded')) return 'Failed to send SMS, try again later or through a different phone number.';
        return msg;
    };

    const sendVerification = async () => {
        setError(null);
        const normalized = normalizePhoneNumber(phone);
        if (!normalized || normalized.length < 10) {
            setError('Please enter a valid phone number');
            return;
        }

        setPhone(normalized);
        setLoading(true);
        try {
            if (recaptchaVerifier.current && !(recaptchaVerifier.current as any)._reset) {
                (recaptchaVerifier.current as any)._reset = () => { };
            }

            const phoneProvider = new PhoneAuthProvider();
            const verId = await phoneProvider.verifyPhoneNumber(
                normalized,
                recaptchaVerifier.current!
            );
            setVerificationId(verId);
        } catch (err: any) {
            setError(getErrorMessage(err));
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const confirmCode = async () => {
        setError(null);
        if (!verificationCode || !verificationId) {
            setError('Please enter the verification code');
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
            console.log('Login error details:', err);
            const errorMsg = getErrorMessage(err);

            if (err.message && (err.message.includes('User not found') || err.message.includes('404'))) {
                const currentUser = auth.currentUser;
                if (currentUser) {
                    const token = await currentUser.getIdToken();
                    router.push({ pathname: '/auth/signup', params: { token } });
                }
            } else if (errorMsg) {
                setError(errorMsg);
            } else {
                setError('Authentication failed. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
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

                    {error && (
                        <View style={styles.errorContainer}>
                            <ThemedText style={styles.errorText}>{error}</ThemedText>
                        </View>
                    )}

                    {!verificationId ? (
                        <>
                            <ThemedText style={styles.label}>Phone Number</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="+923001234567"
                                placeholderTextColor="#888"
                                autoComplete="tel"
                                keyboardType="phone-pad"
                                textContentType="telephoneNumber"
                                onChangeText={(text) => {
                                    setPhone(text);
                                    if (error) setError(null);
                                }}
                                value={phone}
                            />

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={sendVerification}
                                activeOpacity={0.8}
                                disabled={loading}
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
                                onChangeText={(text) => {
                                    setVerificationCode(text);
                                    if (error) setError(null);
                                }}
                                value={verificationCode}
                            />

                            <TouchableOpacity
                                style={styles.primaryButton}
                                onPress={confirmCode}
                                activeOpacity={0.8}
                                disabled={loading}
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
    },
    errorContainer: {
        backgroundColor: '#FFE5E5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#FF000033',
    },
    errorText: {
        color: '#D00000',
        fontSize: 14,
        textAlign: 'center',
        fontWeight: '500',
    }
});
