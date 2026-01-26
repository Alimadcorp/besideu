import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

/**
 * Check for updates and download them automatically
 * This should be called when the app starts
 */
export async function checkForUpdates() {
    try {
        // Skip in development mode
        if (__DEV__) {
            console.log('Skipping update check in development mode');
            return;
        }

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
            console.log('Update available, downloading...');
            await Updates.fetchUpdateAsync();

            // Reload the app to apply the update
            await Updates.reloadAsync();
        } else {
            console.log('App is up to date');
        }
    } catch (error) {
        console.error('Error checking for updates:', error);
        // Don't show alert to user, just log the error
    }
}

/**
 * Manually check for updates with user feedback
 * Use this for a manual "Check for Updates" button
 */
export async function manualUpdateCheck() {
    try {
        if (__DEV__) {
            Alert.alert('Development Mode', 'Updates are not available in development mode');
            return;
        }

        const update = await Updates.checkForUpdateAsync();

        if (update.isAvailable) {
            Alert.alert(
                'Update Available',
                'A new version is available. Download now?',
                [
                    { text: 'Later', style: 'cancel' },
                    {
                        text: 'Update',
                        onPress: async () => {
                            await Updates.fetchUpdateAsync();
                            await Updates.reloadAsync();
                        }
                    }
                ]
            );
        } else {
            Alert.alert('Up to Date', 'You are running the latest version');
        }
    } catch (error) {
        Alert.alert('Error', 'Failed to check for updates');
        console.error('Error checking for updates:', error);
    }
}
