import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadProfile, saveProfile } from './src/api/client';
import type { UserProfile } from './src/types';
import Onboarding from './src/screens/Onboarding';
import Home from './src/screens/Home';

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadProfile().then((p) => {
      setProfile(p);
      setHydrated(true);
    });
  }, []);

  if (!hydrated) {
    return <SafeAreaProvider>{null}</SafeAreaProvider>;
  }

  const handleDone = async (p: UserProfile) => {
    await saveProfile(p);
    setProfile(p);
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {profile ? (
        <Home profile={profile} goHome={() => setProfile(null)} />
      ) : (
        <Onboarding onDone={handleDone} />
      )}
    </SafeAreaProvider>
  );
}