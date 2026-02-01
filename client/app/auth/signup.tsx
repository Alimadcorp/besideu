import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, ActivityIndicator, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import FirebaseRecaptchaVerifierModal, { FirebaseRecaptchaVerifier } from '@/components/FirebaseRecaptcha';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { auth, firebase, PhoneAuthProvider } from '@/utils/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { normalizePhoneNumber } from '@/utils/crypto';

export default function SignupScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();

    const [username, setUsername] = useState('');
    const [realName, setRealName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { signUp } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];
    const insets = useSafeAreaInsets();
    const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifier>(null);

    const isProfileCompletion = !!token;

    const getErrorMessage = (err: any) => {
        const msg = err.message || String(err);
        if (msg.includes('invalid-phone-number')) return 'The phone number you entered is invalid.';
        if (msg.includes('too-many-requests')) return 'Too many attempts. Please try again later.';
        if (msg.includes('invalid-verification-code')) return 'The code you entered is incorrect.';
        if (msg.includes('code-expired')) return 'The verification code has expired.';
        if (msg.includes('user-disabled')) return 'This account has been disabled.';
        if (msg.includes('Network request failed')) return 'Connection error. Check your internet.';
        if (msg.includes('Username already taken')) return 'This username is already taken. Try another.';
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
        } finally {
            setLoading(false);
        }
    };

    const confirmCodeAndSignup = async () => {
        setError(null);
        if (!verificationCode || !verificationId) {
            setError('Please enter the verification code');
            return;
        }
        if (!username || !realName) {
            setError('Please fill in required fields');
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

            await signUp(idToken, username, realName, email);
        } catch (err: any) {
            setError(getErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const completeProfile = async () => {
        setError(null);
        if (!username || !realName) {
            setError('Please fill in required fields');
            return;
        }
        setLoading(true);
        try {
            await signUp(token!, username, realName, email);
        } catch (err: any) {
            setError(getErrorMessage(err));
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
                {!isProfileCompletion && (
                    <FirebaseRecaptchaVerifierModal
                        ref={recaptchaVerifier}
                        firebaseConfig={firebase.app().options}
                    />
                )}

                <View style={styles.content}>
                    <ThemedText type="title" style={styles.title}>
                        {isProfileCompletion ? 'Complete Profile' : 'Create Account'}
                    </ThemedText>
                    <ThemedText style={styles.subtitle}>
                        {isProfileCompletion ? 'Just a few more details' : 'Join BesideU today'}
                    </ThemedText>

                    {error && (
                        <View style={styles.errorContainer}>
                            <ThemedText style={styles.errorText}>{error}</ThemedText>
                        </View>
                    )}

                    {/* Common Fields */}
                    {(verificationId || isProfileCompletion) && (
                        <>
                            <ThemedText style={styles.label}>Real Name *</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="John Doe"
                                placeholderTextColor="#888"
                                onChangeText={(text) => {
                                    setRealName(text);
                                    if (error) setError(null);
                                }}
                                value={realName}
                            />

                            <ThemedText style={styles.label}>Username *</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="johndoe_ravian"
                                placeholderTextColor="#888"
                                autoCapitalize="none"
                                maxLength={31}
                                onChangeText={(text) => {
                                    // Only allow lowercase a-z, 0-9, and underscores
                                    const filtered = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                                    setUsername(filtered);
                                    if (error) setError(null);
                                }}
                                value={username}
                            />
                            <ThemedText style={{ fontSize: 10, opacity: 0.5, marginTop: -15, marginBottom: 15, marginLeft: 5 }}>
                                Lowercase, numbers and underscores only (max 31 chars)
                            </ThemedText>

                            <ThemedText style={styles.label}>Email (Optional)</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="john@example.com"
                                placeholderTextColor="#888"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onChangeText={(text) => {
                                    setEmail(text);
                                    if (error) setError(null);
                                }}
                                value={email}
                            />
                        </>
                    )}

                    {/* Flow A: Direct Signup (Phone Input) */}
                    {!isProfileCompletion && !verificationId && (
                        <>
                            <ThemedText style={styles.label}>Phone Number</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="+1234567890"
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
                            <TouchableOpacity style={styles.primaryButton} onPress={sendVerification}>
                                {loading ? <ActivityIndicator color="white" /> : <ThemedText style={styles.primaryButtonText}>Verify Phone</ThemedText>}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Flow A: Verification Code */}
                    {!isProfileCompletion && verificationId && (
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
                            <TouchableOpacity style={styles.primaryButton} onPress={confirmCodeAndSignup}>
                                {loading ? <ActivityIndicator color="white" /> : <ThemedText style={styles.primaryButtonText}>Create Account</ThemedText>}
                            </TouchableOpacity>
                        </>
                    )}

                    {/* Flow B: Complete Profile */}
                    {isProfileCompletion && (
                        <TouchableOpacity style={styles.primaryButton} onPress={completeProfile}>
                            {loading ? <ActivityIndicator color="white" /> : <ThemedText style={styles.primaryButtonText}>Finish Setup</ThemedText>}
                        </TouchableOpacity>
                    )}

                    {!isProfileCompletion && (
                        <View style={styles.footer}>
                            <ThemedText>Already have an account? </ThemedText>
                            <Link href="/auth/login">
                                <ThemedText style={{ color: theme.tint, fontWeight: 'bold' }}>Sign In</ThemedText>
                            </Link>
                        </View>
                    )}
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
        marginTop: 20,
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
