import {Stack} from "expo-router";
import React, {useEffect, useState} from "react";
import Utils from "expo-utils/utils/Utils";
// @ts-ignore
import appConfig from '../../app.json';


export default function RootLayout() {
    const [appIsReady, setAppIsReady] = useState(false);
    useEffect(() => {
        Utils.prepare(setAppIsReady, (appConfig as any)).then();
    }, []);

    if (!appIsReady) {
        return null;
    }

    return <Stack/>;
} 