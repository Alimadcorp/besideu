import React, { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Alert, ActivityIndicator, View, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Link, useLocalSearchParams } from 'expo-router';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/context/AuthContext';
import { auth, firebase, PhoneAuthProvider } from '@/utils/firebase';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SignupScreen() {
    const { token } = useLocalSearchParams<{ token: string }>();

    const [username, setUsername] = useState('');
    const [realName, setRealName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verificationId, setVerificationId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { signUp } = useAuth();
    const router = useRouter();
    const colorScheme = useColorScheme();
    const theme = Colors[colorScheme ?? 'light'];

    const recaptchaVerifier = React.useRef<FirebaseRecaptchaVerifierModal>(null);

    const isProfileCompletion = !!token;

    const sendVerification = async () => {
        if (!phone) {
            Alert.alert('Error', 'Please enter a phone number');
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
            Alert.alert('Success', 'Verification code has been sent.');
        } catch (err: any) {
            Alert.alert('Error', err.message);
        } finally {
            setLoading(false);
        }
    };

    const confirmCodeAndSignup = async () => {
        if (!verificationCode || !verificationId) {
            Alert.alert('Error', 'Please enter the verification code');
            return;
        }
        if (!username || !realName) {
            Alert.alert('Error', 'Please fill in required fields');
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
            Alert.alert('Error', `Signup failed: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const completeProfile = async () => {
        if (!username || !realName) {
            Alert.alert('Error', 'Please fill in required fields');
            return;
        }
        setLoading(true);
        try {
            await signUp(token, username, realName, email);
        } catch (err: any) {
            Alert.alert('Error', `Profile creation failed: ${err.message}`);
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

                    {/* Common Fields */}
                    {(verificationId || isProfileCompletion) && (
                        <>
                            <ThemedText style={styles.label}>Real Name *</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="John Doe"
                                placeholderTextColor="#888"
                                onChangeText={setRealName}
                                value={realName}
                            />

                            <ThemedText style={styles.label}>Username *</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="johndoe"
                                placeholderTextColor="#888"
                                autoCapitalize="none"
                                onChangeText={setUsername}
                                value={username}
                            />

                            <ThemedText style={styles.label}>Email (Optional)</ThemedText>
                            <TextInput
                                style={[styles.input, { color: theme.text, borderColor: theme.icon }]}
                                placeholder="john@example.com"
                                placeholderTextColor="#888"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                onChangeText={setEmail}
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
                                onChangeText={setPhone}
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
                                onChangeText={setVerificationCode}
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
    }
});
