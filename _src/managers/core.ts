import { NaniumRepository } from '../interfaces/serviceRepository';
import { ConstructorType, genericTypesSymbol, responseTypeSymbol } from '../objects';


export function getPrimaryResponseType(requestOrConstructor: ConstructorType | any): ConstructorType | undefined;
export function getPrimaryResponseType(repo: NaniumRepository, serviceName: string): ConstructorType | undefined;
export function getPrimaryResponseType(repoOrRequestOrConstructor: NaniumRepository | any, serviceName?: string): ConstructorType | undefined {
	let ResponseType: any;
	let GenericTypes: any;

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

export function getSecondaryResponseType(requestOrConstructor: ConstructorType | any): ConstructorType | undefined;
export function getSecondaryResponseType(repo: NaniumRepository, serviceName: string): ConstructorType | undefined;
export function getSecondaryResponseType(repoOrRequestOrConstructor: NaniumRepository | any, serviceName?: string): ConstructorType | undefined {
	let ResponseType: any;

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
