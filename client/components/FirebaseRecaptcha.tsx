import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Modal, StyleSheet, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { ThemedText } from './themed-text';

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
    </head>
    <body style="margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: transparent;">
        <div id="recaptcha-container"></div>
        <script>
            try {
                const firebaseConfig = ${JSON.stringify(firebaseConfig)};
                firebase.initializeApp(firebaseConfig);
                
                const verifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
                    size: 'normal', // Use normal so it's visible in the modal
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
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <ThemedText type="defaultSemiBold">{title}</ThemedText>
                        <TouchableOpacity onPress={handleCancel}>
                            <ThemedText style={styles.cancel}>{cancelLabel}</ThemedText>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.webviewContainer}>
                        <WebView
                            source={{ html }}
                            onMessage={onMessage}
                            style={{ backgroundColor: 'transparent' }}
                            javaScriptEnabled
                            originWhitelist={['*']}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    container: {
        backgroundColor: 'white',
        borderRadius: 20,
        height: 400,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
    },
    cancel: {
        color: '#ff4444',
        fontWeight: 'bold',
    },
    webviewContainer: {
        flex: 1,
    }
});

export default FirebaseRecaptchaVerifierModal;
