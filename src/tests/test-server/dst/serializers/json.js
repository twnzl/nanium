export class NaniumJsonSerializer {
    constructor(packageSeparator = '\0nanium\0', mimeType = 'application/json') {
        this.packageSeparator = packageSeparator;
        this.mimeType = mimeType;
    }
    deserialize(raw) {
        try {
            if (typeof raw === 'string') {
                return raw ? JSON.parse(raw) : undefined;
            }
            else {
                return raw?.byteLength ? JSON.parse(new TextDecoder('utf-8').decode(raw)) : undefined;
            }
        }
        catch (e) {
            throw new Error('NaniumJsonSerializer: error while deserializing: "' + raw + '"');
        }
    }
    serialize(obj) {
        return JSON.stringify(obj);
    }
    serializePartial(obj) {
        return JSON.stringify(obj) + this.packageSeparator;
    }
    deserializePartial(raw, restFromLastTime) {
        let txt;
        if (typeof raw === 'string') {
            txt = raw;
        }
        else {
            txt = new TextDecoder('utf-8').decode(raw);
        }
        if (restFromLastTime) {
            txt = restFromLastTime + txt;
        }
        let deserialized;
        let rest;
        const packets = txt.split(this.packageSeparator);
        const result = [];
        rest = packets.pop();
        for (const packet of packets) {
            deserialized = this.deserialize(packet);
            result.push(deserialized);
        }
        return { data: result, rest };
    }
}
//# sourceMappingURL=json.js.map