import { StyleSheet } from 'react-native';

export const ExpoUtilsStyles = StyleSheet.create({
    footerBanner: {
        position: "absolute",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        flex: 1,
        bottom: 10,
        width: "100%",
        gap: 10,
        zIndex: 1000,
    },
    
    // Outros estilos úteis
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    centerContent: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    
    fullWidth: {
        width: '100%',
    },
    
    fullHeight: {
        height: '100%',
    },
    
    absoluteFill: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    
    shadow: {
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    
    card: {
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
});

export default ExpoUtilsStyles; 