import {useEffect} from "react";
import {usePathname} from "expo-router";
import {setCurrentRoute} from "./AdPlacementTracker";

/**
 * Invisible component that tracks the current route via expo-router.
 * Place this in your root _layout.tsx:
 *
 * ```tsx
 * import { RouteTracker } from 'expo-utils/utils/RouteTracker';
 *
 * return (
 *   <>
 *     <RouteTracker />
 *     <Stack>...</Stack>
 *   </>
 * );
 * ```
 */
export default function RouteTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (pathname) {
            setCurrentRoute(pathname);
        }
    }, [pathname]);

    return null;
}
