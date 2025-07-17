import {Stack} from "expo-router";
import Utils from "expo-utils/utils/Utils";
import React, {useEffect, useState} from "react";
import appConfig from "../../app.json";
import adUnits from "../constants/Strings";

declare global {
    var remoteConfigs: any;
    var isAdsEnabled: boolean;
    var adUnits: any;
}

export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    useEffect(() => {
        global.isAdsEnabled = !__DEV__;
        Utils.prepare(setAppIsReady, appConfig, adUnits).then();
    }, []);

    if (!appIsReady) {
        return null;
    }

    return (
        <Stack>
            <Stack.Screen name="(tabs)" options={{headerShown: false}}/>
        </Stack>
    );
}