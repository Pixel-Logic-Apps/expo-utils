import React from "react";
import {ActivityIndicator, Platform, StyleSheet, Text as RNText, TouchableOpacity, type StyleProp, type ViewStyle} from "react-native";
import {requireOptionalNativeModule} from "expo";
import {Button, Host, ProgressView, Text} from "@expo/ui/swift-ui";
import {
    buttonStyle,
    contentShape,
    controlSize,
    disabled as swiftDisabled,
    foregroundStyle,
    frame,
    lineLimit,
    minimumScaleFactor,
    multilineTextAlignment,
    padding,
    shapes,
    tint,
} from "@expo/ui/swift-ui/modifiers";

/**
 * Botão dos modais da lib (review e retenção).
 *
 * iOS 26+: o botão Liquid Glass NATIVO do SwiftUI (`glassProminent`, via @expo/ui), com `color` de tint — no
 * principal a cor do app, no secundário o cinza do sistema. O `glass` puro ficou de fora: sobre o card branco
 * ele sai #FDFDFD, igual ao fundo (medido no simulador), e o "Agora não" some. O @expo/ui é dependência do
 * expo-router 57, então o módulo nativo já está no binário dos apps.
 *
 * Android, iOS < 26 (lá o @expo/ui troca `glassProminent` por `.automatic`, um botão sem fundo) e binário sem o
 * módulo nativo (JS novo por OTA num binário antigo): cápsula em RN com os números medidos no nativo — 50 de
 * altura, texto 17 regular.
 *
 * `text`: só o rótulo, sem fundo nem borda (o "Agora não" empilhado da retenção e do `centered` do review). No
 * iOS 26 é um botão SwiftUI `plain`, com toque e Dynamic Type do sistema como o glass ao lado.
 */
const NATIVE_GLASS =
    Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26 && requireOptionalNativeModule("ExpoUI") != null;

/** Cinza do secundário: o que o iOS desenha no `bordered` nativo (secondarySystemFill sobre o fundo). */
export const GLASS_SECONDARY = {light: "#E9E9EB", dark: "#39393D"};

const DIMMED = 0.4;
/** O desabilitado do SwiftUI só leva o texto a ~#3A3A3A; com 0.5 por cima ele chega ao ~#999 da cápsula a 0.4. */
const NATIVE_DIMMED = 0.5;
const NOOP = () => {};

export interface GlassButtonProps {
    label: string;
    onPress: () => void;
    /** `filled`: cápsula cheia (no iOS 26, glass com `color` de tint); `text`: só o rótulo, em `textColor` */
    variant?: "filled" | "text";
    /** fundo da cápsula (`filled`); no iOS 26, o tint do glass */
    color?: string;
    textColor: string;
    disabled?: boolean;
    /** spinner no lugar do texto (compra em andamento): bloqueia o toque, mas não apaga o botão */
    busy?: boolean;
    /** 1 = uma linha que encolhe para caber; mais = quebra até esse número de linhas */
    numberOfLines?: number;
    /** layout no pai (flex, alignSelf) */
    style?: StyleProp<ViewStyle>;
    colorScheme?: "light" | "dark";
    /** direção do texto quando difere da do app (o modal de retenção em árabe) */
    rtl?: boolean;
}

export function GlassButton({
    label,
    onPress,
    variant = "filled",
    color = "transparent",
    textColor,
    disabled = false,
    busy = false,
    numberOfLines = 1,
    style,
    colorScheme,
    rtl,
}: GlassButtonProps) {
    const dimmed = disabled && !busy;
    const press = disabled || busy ? NOOP : onPress;
    const textOnly = variant === "text";

    if (NATIVE_GLASS) {
        const textModifiers = [
            foregroundStyle(textColor),
            lineLimit(numberOfLines),
            multilineTextAlignment("center" as const),
            ...(numberOfLines === 1 ? [minimumScaleFactor(0.6)] : []),
        ];
        return (
            <Host
                matchContents={{vertical: true}}
                // O RN já posiciona o botão fora das barras do sistema. Sem isto o SwiftUI aplica a área segura de
                // baixo enquanto o card entra deslizando por baixo da tela e não desfaz depois: o vidro ficava 17pt
                // acima do lugar (formsheet e contagem do review, medido no simulador).
                ignoreSafeArea="all"
                colorScheme={colorScheme}
                {...(rtl === undefined ? {} : {layoutDirection: rtl ? ("rightToLeft" as const) : ("leftToRight" as const)})}
                // minHeight: a altura nativa só chega depois do 1º layout do SwiftUI; sem isso o card pula
                style={[textOnly ? styles.textHost : styles.host, style, dimmed && styles.nativeDimmed]}>
                {textOnly ? (
                    <Button onPress={press} modifiers={[buttonStyle("plain"), swiftDisabled(dimmed)]}>
                        {/* área de toque = o retângulo todo (no `plain` só o conteúdo recebe toque) */}
                        <Text
                            modifiers={[
                                ...textModifiers,
                                padding({horizontal: 12}),
                                frame({maxWidth: Infinity, minHeight: 44}),
                                contentShape(shapes.rectangle()),
                            ]}>
                            {label}
                        </Text>
                    </Button>
                ) : (
                    <Button onPress={press} modifiers={[buttonStyle("glassProminent"), controlSize("large"), tint(color), swiftDisabled(dimmed)]}>
                        {busy ? (
                            // `regular` no spinner: sem ele o ProgressView herdava o `large` do botão (35pt) e o botão
                            // crescia de 50 para 67pt enquanto comprava. Regular = 20pt, o do ActivityIndicator do RN, e
                            // o botão fica nos 50pt do texto (o small encolhia para 44). Medido no iPhone 17 Pro, iOS 26.5.
                            <ProgressView modifiers={[controlSize("regular"), frame({maxWidth: Infinity}), tint(textColor)]} />
                        ) : (
                            // frame no TEXTO, não no botão: é o rótulo que estica a cápsula até a largura do pai
                            <Text modifiers={[frame({maxWidth: Infinity}), ...textModifiers]}>{label}</Text>
                        )}
                    </Button>
                )}
            </Host>
        );
    }

    return (
        <TouchableOpacity
            onPress={press}
            disabled={disabled || busy}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{disabled, busy}}
            style={[textOnly ? styles.textButton : [styles.capsule, {backgroundColor: color}], style, dimmed && styles.dimmed]}>
            {busy ? (
                <ActivityIndicator color={textColor} />
            ) : (
                <RNText numberOfLines={numberOfLines} adjustsFontSizeToFit={numberOfLines === 1} style={[styles.text, {color: textColor}]}>
                    {label}
                </RNText>
            )}
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    host: {
        minHeight: 50,
    },
    textHost: {
        minHeight: 44,
    },
    /* Capsula: borderRadius acima da metade da altura vira meio circulo nas pontas em qualquer altura. */
    capsule: {
        minHeight: 50,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        alignItems: "center",
        justifyContent: "center",
    },
    // so o rotulo: 44 de altura, o minimo de area de toque das duas lojas
    textButton: {
        minHeight: 44,
        paddingHorizontal: 12,
        alignItems: "center",
        justifyContent: "center",
    },
    // 17 regular: o peso do rotulo do botao glass nativo (haste/altura do "l" 0,114, igual ao RN 400)
    text: {
        fontSize: 17,
        fontWeight: "400",
        textAlign: "center",
    },
    dimmed: {
        opacity: DIMMED,
    },
    nativeDimmed: {
        opacity: NATIVE_DIMMED,
    },
});
