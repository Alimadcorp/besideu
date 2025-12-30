import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, ActivityIndicator, useColorScheme, SafeAreaView } from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedText } from './themed-text';
import { Colors } from '@/constants/theme';

export interface FirebaseRecaptchaVerifier {
    readonly _reset: () => void;
    readonly verify: () => Promise<string>;
    readonly type: string;
}

interface Props {
    firebaseConfig: any;
    title?: string;
    cancelLabel?: string;
}

const FirebaseRecaptchaVerifierModal = forwardRef((props: Props, ref) => {
    const { firebaseConfig, title = 'Human Verification', cancelLabel = 'Cancel' } = props;
    const [visible, setVisible] = useState(false);
    const [resolve, setResolve] = useState<((token: string) => void) | null>(null);
    const [reject, setReject] = useState<((error: Error) => void) | null>(null);
    const colorScheme = useColorScheme() || 'light';
    const theme = Colors[colorScheme];

    useImperativeHandle(ref, () => ({
        type: 'recaptcha',
        _reset: () => {
            setVisible(false);
        },
        verify: async () => {
            setVisible(true);
            return new Promise<string>((res, rej) => {
                setResolve(() => res);
                setReject(() => rej);
            });
        },
    }));

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/9.0.0/firebase-auth-compat.js"></script>
        <style>
            body { 
                margin: 0; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                background-color: ${theme.background}; 
            }
        </style>
    </head>
    <body>
        <div id="recaptcha-container"></div>
        <script>
            try {
                const firebaseConfig = ${JSON.stringify(firebaseConfig)};
                firebase.initializeApp(firebaseConfig);
                
                const verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    size: 'normal',
                    theme: '${colorScheme}',
                    callback: (response) => {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'success', token: response }));
                    },
                    'expired-callback': () => {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: 'expired' }));
                    }
                });
                
                verifier.render().then(() => {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
                });
            } catch (err) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'error', message: err.message }));
            }
        </script>
    </body>
    </html>
    `;

    const onMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'success') {
                setVisible(false);
                resolve?.(data.token);
            } else if (data.type === 'error') {
                setVisible(false);
                reject?.(new Error(data.message));
            }
        } catch (e) {
            console.error('Failed to parse WebView message', e);
        }
    };

    const handleCancel = () => {
        setVisible(false);
        reject?.(new Error('Cancelled by user'));
    };

    if (!visible) return null;

    return (
        <Modal visible={visible} transparent={false} animationType="slide">
            <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { borderBottomColor: theme.icon + '33' }]}>
                    <ThemedText type="defaultSemiBold" style={{ color: theme.text }}>{title}</ThemedText>
                    <TouchableOpacity onPress={handleCancel}>
                        <ThemedText style={styles.cancel}>{cancelLabel}</ThemedText>
                    </TouchableOpacity>
                </View>
                <View style={styles.webviewContainer}>
                    <WebView
                        source={{
                            html,
                            baseUrl: `https://${firebaseConfig.authDomain}`
                        }}
                        onMessage={onMessage}
                        style={{ backgroundColor: theme.background }}
                        javaScriptEnabled
                        domStorageEnabled={true}
                        originWhitelist={['*']}
                    />
                </View>
            </SafeAreaView>
        </Modal>
    );
});

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        alignItems: 'center',
    },
    cancel: {
        color: '#ff4444',
        fontWeight: 'bold',
        fontSize: 16,
    },
    webviewContainer: {
        flex: 1,
    }
});

export default FirebaseRecaptchaVerifierModal;
