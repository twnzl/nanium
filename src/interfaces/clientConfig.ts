export default interface ClientConfig {
	apiUrl?: string;
	protocol?: 'http' | 'websocket';
	exceptionHandler?: (response: any) => void;
}
