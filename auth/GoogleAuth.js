import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../configs/firebaseConfig';

WebBrowser.maybeCompleteAuthSession();

const redirectUri = 'https://auth.expo.io/@faresms/test-da';

export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: '592866597778-g7ps96st2uerd4sa73mvjkrg2rejifcg.apps.googleusercontent.com',
    iosClientId: '592866597778-g7ps96st2uerd4sa73mvjkrg2rejifcg.apps.googleusercontent.com',
    androidClientId: '592866597778-g7ps96st2uerd4sa73mvjkrg2rejifcg.apps.googleusercontent.com',
    webClientId: '592866597778-g7ps96st2uerd4sa73mvjkrg2rejifcg.apps.googleusercontent.com',
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      if (!id_token) {
        console.error('No ID token returned from Google');
        return;
      }

      const credential = GoogleAuthProvider.credential(id_token);
      signInWithCredential(auth, credential).catch((err) => {
        console.error('Firebase sign-in error:', err);
      });
    }
  }, [response]);

  return { promptAsync, request };
};
export default useGoogleAuth;
