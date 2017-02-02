// Create a scoping variable
if (typeof(IDVM) == 'undefined') {
	var IDVM = {};
}

// Very loose limits!
IDVM.MAX_NUM_DIGITS = 10;
IDVM.MAX_EXPONENT = 16;

IDVM.MeterMode = {
    Unknown : {value: -1, name: "Unknown"},
    Off: {value: 0, name: "Off"},
    ACVolts: {value: 1, name: "Voltage-AC"},
    Volts: {value: 2, name: "Voltage-DC"},
    Ohms: {value: 3, name: "Resistance"},
    ACAmps: {value: 4, name: "Current-AC"},
    Amps: {value: 5, name: "Current-DC"},
    Frequency: {value: 6, name: "Frequency"},
    Capacitance: {value: 7, name: "Capacitance"},
    TemperatureFahrenheit: {value: 8, name: "Temperature-F"},
    TemperatureCelsius: {value: 9, name: "Temperature-C"},
    NonContactVoltage: {value: 10, name: "NCV"},
    Continuity: {value: 11, name: "Continuity"},
    Diode: {value: 12, name: "Diode"},
    DutyCycle: {value: 13, name: "Duty Cycle"}
};

IDVM.parseMeasurement = function(meterData, v1_0) {

    let bytes = meterData.buffer;
    let uint8Data = new Uint8ClampedArray(bytes);
    if (uint8Data[0] == 0x72) {
        uint8Data = new Uint8ClampedArray(bytes.slice(1));
    }
    let modeByte = uint8Data[0];
    let flagsByte = uint8Data[1];
    let meterMode = IDVM.parseMeterMode(modeByte, flagsByte, v1_0);
    let units = IDVM.unitsForMode(meterMode);
    let ac = IDVM.parseAC(flagsByte);
    let dc = v1_0 ? IDVM.parseDC_V1_0(flagsByte) : IDVM.parseDC_V1_1(flagsByte);
    let holding = IDVM.parseHolding(flagsByte);
    let ncv = v1_0 ? IDVM.parseNCV_V1_0(flagsByte) : true;
    
    let bcdBytes = new Uint8ClampedArray(uint8Data.slice(2));
    let range = bcdBytes.length > 0 ? IDVM.parseSint(bcdBytes[0]) : 0;
    
    let displayValue = "";
    let value = IDVM.parseValueFromBcdData(bcdBytes);
    if (value == NaN) {
        displayValue = "NaN";
    } else if (meterMode == IDVM.MeterMode.NonContactVoltage) {
        if (value != 0) {
            value = 1;
            displayValue = "ON";
        } else {
            displayValue = "OFF";
        }
    } else {
        displayValue = IDVM.parseDisplayValueFromBcdData(bcdBytes, meterMode);
    }
    return displayValue;
    //return { "value" : value, "displayValue" : displayValue, "units" : units, "dc" : dc, "ac" : ac,
    //"holding" : holding, "ncv" : ncv, };
}

IDVM.Measurement = function(meterData, v1_0) {

    let bytes = meterData.buffer;
    let uint8Data = new Uint8ClampedArray(bytes);
    if (uint8Data[0] == 0x72) {
        uint8Data = new Uint8ClampedArray(bytes.slice(1));
    }
    let modeByte = uint8Data[0];
    let flagsByte = uint8Data[1];
    this.meterMode = IDVM.parseMeterMode(modeByte, flagsByte, v1_0);
    this.units = IDVM.unitsForMode(this.meterMode);
    this.ac = IDVM.parseAC(flagsByte);
    this.dc = v1_0 ? IDVM.parseDC_V1_0(flagsByte) : IDVM.parseDC_V1_1(flagsByte);
    this.holding = IDVM.parseHolding(flagsByte);
    this.ncv = v1_0 ? IDVM.parseNCV_V1_0(flagsByte) : true;
    
    let bcdBytes = new Uint8ClampedArray(uint8Data.slice(2));
    this.range = bcdBytes.length > 0 ? IDVM.parseSint(bcdBytes[0]) : 0;
    
    let displayValue = "";
    let value = IDVM.parseValueFromBcdData(bcdBytes);
    if (value == NaN) {
        displayValue = "NaN";
    } else if (this.meterMode == IDVM.MeterMode.NonContactVoltage) {
        if (value != 0) {
            value = 1;
            displayValue = "ON";
        } else {
            displayValue = "OFF";
        }
    } else {
        displayValue = IDVM.parseDisplayValueFromBcdData(bcdBytes, this.meterMode);
    }
    this.value = value;
    this.displayValue = displayValue;
    //return { "value" : value, "displayValue" : displayValue, "units" : units, "dc" : dc, "ac" : ac,
    //"holding" : holding, "ncv" : ncv, };
}

IDVM.parseMeterMode = function(mode, flags, v1_0) {
    let meterMode = IDVM.MeterMode.Unknown;
    let isAC = IDVM.parseAC(flags);
    let isDC = v1_0 ? IDVM.parseDC_V1_0(flags) : IDVM.parseDC_V1_1(flags);
    let isDiode = IDVM.parseDiode(flags);
    let isContinuity = IDVM.parseContinuity(flags);
    let isNCV = v1_0 ? IDVM.parseNCV_V1_0(flags) : true;

    switch (mode) {
        case 0:
            meterMode = isNCV ? IDVM.MeterMode.NonContactVoltage : IDVM.MeterMode.Off;
            break;
        case 1:
            if (isDiode) {
                meterMode = IDVM.MeterMode.Diode;
            } else if (isAC && !isDC) {
                meterMode = IDVM.MeterMode.ACVolts;
            } else if (!isAC && isDC) {
                meterMode = IDVM.MeterMode.Volts;
            }
            break;
        case 2:
            if (isAC && !isDC) {
                meterMode = IDVM.MeterMode.ACAmps;
            } else if (!isAC && isDC) {
                meterMode = IDVM.MeterMode.Amps;
            }
            break;
        case 3:
            meterMode = IDVM.MeterMode.Frequency;
            break;
        case 4:
            meterMode = IDVM.MeterMode.DutyCycle;
            break;
        case 5:
            meterMode = IDVM.MeterMode.Capacitance;
            break;
        case 6:
            meterMode = isContinuity ? IDVM.MeterMode.Continuity : IDVM.MeterMode.Ohms;
            break;
        case 7:
            meterMode = IDVM.MeterMode.TemperatureCelsius;
            break;
        case 8:
            meterMode = IDVM.MeterMode.TemperatureFahrenheit;
            break;
        default:
            break;
    }
    return meterMode;
}

IDVM.parseValueFromBcdData = function(bcdData) {
    let bcdValue = NaN;

    if (bcdData.length >= 2) {
        let exponent = IDVM.parseSint(bcdData[0]);
        let signAndLength = IDVM.parseSint(bcdData[1]);
        let numDigits = Math.abs(signAndLength);

        if (numDigits == 0) {
            bcdValue = 0;
        } else if ((numDigits <= IDVM.MAX_NUM_DIGITS) && (Math.abs(exponent) <= IDVM.MAX_EXPONENT)) {
            let numBcdBytes = Math.ceil(numDigits / 2.0);
            if (bcdData.length >= 2 + numBcdBytes) {
                let mantissa = 0;
                let digitCount = 0;
                for (i = 2; i < 2 + numBcdBytes; i++) {
                    let b = bcdData[i] & 0xFF;
                    mantissa *= 100;
                    let high = b >> 4;
                    let low = b & 0x0F;
                    if ((low > 9) || (high > 9)) {
                        break;
                    }
                    mantissa += (10 * high);
                    if (++digitCount < numDigits) {
                        mantissa += low;
                        ++digitCount;
                    } else {
                        mantissa /= 10; // odd number of digits
                    }
                }
                if (digitCount == numDigits) {
                    if (mantissa == 0) {
                        bcdValue = 0;
                    } else {
                        if (signAndLength < 0) {
                            mantissa = -mantissa;
                        }
                        bcdValue = mantissa * Math.pow(10, -exponent); //BigDecimal.valueOf(mantissa, -exponent);
                    }
                }
            }
        }
    }
    return bcdValue;
}

IDVM.parseDisplayValueFromBcdData = function(bcdData, meterMode) {
    let displayValue = "";

    if (bcdData.length >= 2) {
        let exponent = IDVM.parseSint(bcdData[0]);
        let signAndLength = IDVM.parseSint(bcdData[1]);
        let numDigits = Math.abs(signAndLength);

        if ((numDigits > 0) && (numDigits <= IDVM.MAX_NUM_DIGITS) && (Math.abs(exponent) <= IDVM.MAX_EXPONENT)) {
            let bcdBytes = Math.ceil(numDigits / 2.0);
            if (bcdData.length >= 2 + bcdBytes) {
                let value = "";
                let digitCount = 0;
                for (i = 2; i < 2 + bcdBytes; i++) {
                    let b = bcdData[i] & 0xFF;
                    let high = b >> 4;
                    let low = b & 0x0F;
                    if ((low > 9) || (high > 9)) {
                        value = "";
                        break;
                    }
                    value = value.concat(high.toString());
                    if (++digitCount < numDigits) {
                        value = value.concat(low.toString());
                        digitCount++;
                    }
                }
                displayValue = IDVM.formatDisplayValueForBcdDigits(value, exponent, (signAndLength < 0), meterMode);
            }
        }
    }
    return displayValue;
}

IDVM.unitsForMode = function(meterMode) {
    let units = "";

    switch (meterMode) {
       case IDVM.MeterMode.ACVolts:
            units = "V-AC";
            break;
        case IDVM.MeterMode.Volts:
            units = "V-DC";
            break;
        case IDVM.MeterMode.Ohms:
            units = "Ω";
            break;
        case IDVM.MeterMode.ACAmps:
            units = "A-AC";
            break;
        case IDVM.MeterMode.Amps:
            units = "A-DC";
            break;
        case IDVM.MeterMode.Frequency:
            units = "Hz";
            break;
        case IDVM.MeterMode.Capacitance:
            units = "F";
            break;
        case IDVM.MeterMode.TemperatureFahrenheit:
            units = "°F";
            break;
        case IDVM.MeterMode.TemperatureCelsius:
            units = "°C";
            break;
        case IDVM.MeterMode.DutyCycle:
            units = "%";
            break;
        default:
            units = "";
    }
    return units;
}

IDVM.unitsForModeNoACDC = function(meterMode) {
    let units = "";

    switch (meterMode) {
        case IDVM.MeterMode.ACVolts:
        case IDVM.MeterMode.Volts:
            units = "V";
            break;
        case IDVM.MeterMode.ACAmps:
        case IDVM.MeterMode.Amps:
            units = "A";
            break;
        default:
            units = IDVM.unitsForMode(meterMode);
    }
    return units;
}

IDVM.formatDisplayValueForBcdDigits = function(digits, exponent, isNegative, meterMode) {
    let displayValue = "";
    let numDigits = digits.length;

    if (numDigits > 0) {

        let value = digits;

        // Exceptional cases:
        //
        // Resistance:
        //  <06400304 01080000 00000000 000000> Display: 0.108 MΩ   Parse: 0108 KΩ
        //  <06400004 eeee0000 00000000 000000> Display: .OL kΩ     Parse: OL Ω
        //  <06400104 eeee0000 00000000 000000> Display: O.L kΩ     Parse: OL Ω
        // uA:
        //  <02418604 00000000 00000000 000000> Display: 0000 uA    Parse: 0.000 mA

        // scale = (exponent_orig - exponent_new) / 3
        let scale = 0;
        if (((meterMode == IDVM.MeterMode.Amps) || (meterMode == IDVM.MeterMode.ACAmps)) && (exponent == -6)) {
            scale = -2;
            exponent = 0;
        } else if ((meterMode == IDVM.MeterMode.Ohms) && (exponent == 3)) {
            scale = 2;
            exponent = -3;
        } else {
            while ((exponent > 0)) {
                scale++;
                exponent -= 3;
            }

            if (exponent < 0) {
                while (-exponent >= numDigits) {
                    scale--;
                    exponent += 3;
                }
                if (exponent > 0) {
                    value = value.concat(exponent == 1 ? "0": "00");
                }
            }
        }

        if (exponent < 0) {
            value = value.substr(0, (numDigits+exponent)) + "." + value.substr((numDigits+exponent), value.length);
        }
        if (isNegative) {
            value = "-" + value;
        }

        let suffix = "";
        if (scale == -4) {
            suffix = "p";
        } else if (scale == -3) {
            suffix = "n";
        } else if (scale == -2) {
            suffix = "µ";
        } else if (scale == -1) {
            suffix = "m";
        } else if (scale == 1) {
            suffix = "K";
        } else if (scale == 2) {
            suffix = "M";
        } else if (scale == 3) {
            suffix = "G";
        } else if (scale != 0) {
            suffix = "10^" + scale*3;
        }

        let units = IDVM.unitsForModeNoACDC(meterMode);
        if ((suffix.length > 0) || (units.length > 0)) {
            value = value.concat(" ").concat(suffix).concat(units);
        }
        displayValue = value;
    }
    return displayValue;
}

IDVM.parseSint = function(b) {
    //return ((int)b & 0x80) != 0x00 ? -((int)b & 0x7F) : ((int)b & 0x7F);
    let bint = (0x000000FF & b);
    let testme = (bint & 0x00000080);
    let result = 0;
    if (testme != 0x000000) {
        result = -(bint & 0x0000007F);
    } else {
        result = (bint & 0x0000007F);
    }
    return result;
}
    
IDVM.parseDC_V1_0 = function(flags) {
    return (flags & 0x00000001) != 0x00000000;
}

IDVM.parseDC_V1_1 = function(flags) { 
    return !IDVM.parseAC(flags); 
}

IDVM.parseAC = function(flags) {
    return (flags & (0x00000001 << 1)) != 0x00000000;
}

IDVM.parseHolding = function(flags) {
    return (flags & (0x00000001 << 2)) != 0x00000000;
}

IDVM.parseContinuity = function(flags) {
    return (flags & (0x00000001 << 3)) != 0x00000000;
}

IDVM.parseNCV_V1_0 = function(flags) {
    return (flags & (0x00000001 << 4)) != 0x00000000;
}

IDVM.parseDiode = function(flags) {
    return (flags & (0x00000001 << 5)) != 0x00000000;
}
