import {Dimensions, useWindowDimensions} from "react-native";

type Size = {width: number; height: number};

export type ScreenValue<T> = {
    mini?: T;
    small?: T;
    normal?: T;
    plus?: T;
    max?: T;
    iphoneSe1?: T;
    iphoneSe?: T;
    iphone8?: T;
    iphone8Plus?: T;
    iphoneX?: T;
    iphone11?: T;
    iphone12Mini?: T;
    iphone13Mini?: T;
    iphone12?: T;
    iphone13?: T;
    iphone14?: T;
    iphone16e?: T;
    iphone12ProMax?: T;
    iphone14Plus?: T;
    iphone14Pro?: T;
    iphone14ProMax?: T;
    iphone15?: T;
    iphone15Pro?: T;
    iphone15Plus?: T;
    iphone15ProMax?: T;
    iphone16?: T;
    iphone16Pro?: T;
    iphone16Plus?: T;
    iphone16ProMax?: T;
    ipad?: T;
    ipadLarge?: T;
    medium?: T;
    large?: T;
    default: T;
};

const get = ({width, height}: Size) => ({
    w: Math.round(Math.min(width, height)),
    h: Math.round(Math.max(width, height)),
});

const same = (size: Size, w: number, h: number) => {
    const d = get(size);
    return d.w === w && d.h === h;
};

export class ScreenSize {
    static isIphoneSe1(size: Size) {
        return same(size, 320, 568);
    }

    static isIphoneSe(size: Size) {
        return same(size, 375, 667);
    }

    static isIphone8(size: Size) {
        return this.isIphoneSe(size);
    }

    static isIphone8Plus(size: Size) {
        return same(size, 414, 736);
    }

    static isIphoneX(size: Size) {
        return same(size, 375, 812);
    }

    static isIphone11(size: Size) {
        return same(size, 414, 896);
    }

    static isIphone12Mini(size: Size) {
        return this.isIphoneX(size);
    }

    static isIphone13Mini(size: Size) {
        return this.isIphoneX(size);
    }

    static isIphone12(size: Size) {
        return same(size, 390, 844);
    }

    static isIphone13(size: Size) {
        return this.isIphone12(size);
    }

    static isIphone14(size: Size) {
        return this.isIphone12(size);
    }

    static isIphone16e(size: Size) {
        return this.isIphone12(size);
    }

    static isIphone12ProMax(size: Size) {
        return same(size, 428, 926);
    }

    static isIphone14Plus(size: Size) {
        return this.isIphone12ProMax(size);
    }

    static isIphone14Pro(size: Size) {
        return same(size, 393, 852);
    }

    static isIphone14ProMax(size: Size) {
        return same(size, 430, 932);
    }

    static isIphone15(size: Size) {
        return this.isIphone14Pro(size);
    }

    static isIphone15Pro(size: Size) {
        return this.isIphone14Pro(size);
    }

    static isIphone15Plus(size: Size) {
        return this.isIphone14ProMax(size);
    }

    static isIphone15ProMax(size: Size) {
        return this.isIphone14ProMax(size);
    }

    static isIphone16(size: Size) {
        return this.isIphone14Pro(size);
    }

    static isIphone16Pro(size: Size) {
        return same(size, 402, 874);
    }

    static isIphone16Plus(size: Size) {
        return this.isIphone14ProMax(size);
    }

    static isIphone16ProMax(size: Size) {
        return same(size, 440, 956);
    }

    static isMini(size: Size) {
        const {w, h} = get(size);
        return w <= 375 && h <= 667;
    }

    static isSmall(size: Size) {
        const {w, h} = get(size);
        return w === 375 && h > 667;
    }

    static isNormal(size: Size) {
        const {w} = get(size);
        return w >= 390 && w <= 402;
    }

    static isPlus(size: Size) {
        return get(size).w === 414;
    }

    static isMax(size: Size) {
        const {w} = get(size);
        return w >= 428 && w < 744;
    }

    static isIpad(size: Size) {
        return get(size).w >= 744;
    }

    static isIpadLarge(size: Size) {
        return get(size).w >= 1024;
    }

    static isCompact(size: Size) {
        return get(size).w <= 375;
    }

    static isMedium(size: Size) {
        const {w} = get(size);
        return w > 375 && w <= 414;
    }

    static isLarge(size: Size) {
        return get(size).w > 414;
    }

    static select<T>(size: Size, values: ScreenValue<T>) {
        if (this.isIpadLarge(size) && values.ipadLarge !== undefined) return values.ipadLarge;
        if (this.isIpad(size) && values.ipad !== undefined) return values.ipad;
        if (this.isIphoneSe1(size) && values.iphoneSe1 !== undefined) return values.iphoneSe1;
        if (this.isIphoneSe(size) && values.iphoneSe !== undefined) return values.iphoneSe;
        if (this.isIphone8(size) && values.iphone8 !== undefined) return values.iphone8;
        if (this.isIphone8Plus(size) && values.iphone8Plus !== undefined) return values.iphone8Plus;
        if (this.isIphoneX(size) && values.iphoneX !== undefined) return values.iphoneX;
        if (this.isIphone11(size) && values.iphone11 !== undefined) return values.iphone11;
        if (this.isIphone12Mini(size) && values.iphone12Mini !== undefined) return values.iphone12Mini;
        if (this.isIphone13Mini(size) && values.iphone13Mini !== undefined) return values.iphone13Mini;
        if (this.isIphone12(size) && values.iphone12 !== undefined) return values.iphone12;
        if (this.isIphone13(size) && values.iphone13 !== undefined) return values.iphone13;
        if (this.isIphone14(size) && values.iphone14 !== undefined) return values.iphone14;
        if (this.isIphone16e(size) && values.iphone16e !== undefined) return values.iphone16e;
        if (this.isIphone12ProMax(size) && values.iphone12ProMax !== undefined) return values.iphone12ProMax;
        if (this.isIphone14Plus(size) && values.iphone14Plus !== undefined) return values.iphone14Plus;
        if (this.isIphone14Pro(size) && values.iphone14Pro !== undefined) return values.iphone14Pro;
        if (this.isIphone14ProMax(size) && values.iphone14ProMax !== undefined) return values.iphone14ProMax;
        if (this.isIphone15(size) && values.iphone15 !== undefined) return values.iphone15;
        if (this.isIphone15Pro(size) && values.iphone15Pro !== undefined) return values.iphone15Pro;
        if (this.isIphone15Plus(size) && values.iphone15Plus !== undefined) return values.iphone15Plus;
        if (this.isIphone15ProMax(size) && values.iphone15ProMax !== undefined) return values.iphone15ProMax;
        if (this.isIphone16(size) && values.iphone16 !== undefined) return values.iphone16;
        if (this.isIphone16Pro(size) && values.iphone16Pro !== undefined) return values.iphone16Pro;
        if (this.isIphone16Plus(size) && values.iphone16Plus !== undefined) return values.iphone16Plus;
        if (this.isIphone16ProMax(size) && values.iphone16ProMax !== undefined) return values.iphone16ProMax;
        if (this.isMini(size) && values.mini !== undefined) return values.mini;
        if (this.isSmall(size) && values.small !== undefined) return values.small;
        if (this.isNormal(size) && values.normal !== undefined) return values.normal;
        if (this.isPlus(size) && values.plus !== undefined) return values.plus;
        if (this.isMax(size) && values.max !== undefined) return values.max;
        if (this.isCompact(size) && values.small !== undefined) return values.small;
        if (this.isMedium(size) && values.medium !== undefined) return values.medium;
        if (this.isLarge(size) && values.large !== undefined) return values.large;
        return values.default;
    }

    static get<T>(values: ScreenValue<T>) {
        return this.select(Dimensions.get("window"), values);
    }
}

export function useScreenSize<T>(values: ScreenValue<T>) {
    return ScreenSize.select(useWindowDimensions(), values);
}
