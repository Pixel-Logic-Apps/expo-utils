import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import OnboardingScreen from '../components/OnboardingScreen';
import Utils from '../utils/Utils';
import appConfig from '../app.config';

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
}

global.isAdsEnabled = true;

SplashScreen.preventAutoHideAsync().then();

export default function RootLayout() {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [appIsReady, setAppIsReady] = useState(false);

    useEffect(() => {
        // Substitua por sua configuração do app.config
        Utils.prepare(setAppIsReady, appConfig);
    }, []);

    if (!appIsReady) {
        return null;
    }

    if (showOnboarding) {
        return <OnboardingScreen onComplete={() => setShowOnboarding(false)} />;
    }

    return (
        <>
            <Tabs
                screenOptions={{
                    tabBarActiveTintColor: '#007AFF',
                    headerShown: false,
                }}
            >
                <Tabs.Screen
                    name="index"
                    options={{
                        title: 'Home',
                        tabBarIcon: ({ color, focused }) => (
                            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={24} />
                        ),
                    }}
                />
            </Tabs>
            <StatusBar style="auto" />
        </>
    );
} 