import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
    (window as any).firebase = firebase;
}

export default firebase;
