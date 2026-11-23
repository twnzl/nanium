import { genericTypesSymbol, responseTypeSymbol } from '../objects.js';
export function getPrimaryResponseType(repoOrRequestOrConstructor, serviceName) {
    let ResponseType;
    let GenericTypes;
    // from service repository
    if (serviceName) {
        ResponseType = repoOrRequestOrConstructor[serviceName]?.Request?.[responseTypeSymbol];
        GenericTypes = repoOrRequestOrConstructor[serviceName]?.Request?.[genericTypesSymbol];
        if (ResponseType && GenericTypes) {
            ResponseType[genericTypesSymbol] = GenericTypes;
        }
    }
    // from request
    else {
        ResponseType = repoOrRequestOrConstructor?.[responseTypeSymbol] ?? repoOrRequestOrConstructor?.constructor?.[responseTypeSymbol];
    }
    // primary type
    if (Array.isArray(ResponseType)) {
        ResponseType = ResponseType[0];
    }
    return ResponseType;
}
export function getSecondaryResponseType(repoOrRequestOrConstructor, serviceName) {
    let ResponseType;
    // from service repository
    if (serviceName) {
        ResponseType = repoOrRequestOrConstructor[serviceName]?.Request?.[responseTypeSymbol];
    }
    // from request
    else {
        ResponseType = repoOrRequestOrConstructor?.[responseTypeSymbol] ?? repoOrRequestOrConstructor?.constructor?.[responseTypeSymbol];
    }
    // secondary type
    if (Array.isArray(ResponseType)) {
        ResponseType = ResponseType[1];
    }
    return ResponseType;
}
//# sourceMappingURL=core.js.map