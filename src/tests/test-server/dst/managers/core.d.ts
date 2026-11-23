import { NaniumRepository } from '../interfaces/serviceRepository.js';
import { ConstructorType } from '../objects.js';
export declare function getPrimaryResponseType(requestOrConstructor: ConstructorType | any): ConstructorType | undefined;
export declare function getPrimaryResponseType(repo: NaniumRepository, serviceName: string): ConstructorType | undefined;
export declare function getSecondaryResponseType(requestOrConstructor: ConstructorType | any): ConstructorType | undefined;
export declare function getSecondaryResponseType(repo: NaniumRepository, serviceName: string): ConstructorType | undefined;
