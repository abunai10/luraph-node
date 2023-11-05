import { Buffer } from "node:buffer" // cloudflare only supports buffer if you import as node:buffer

export interface LuraphOptionSpec {
    readonly name: string;
    readonly description: string;
    readonly tier: string;
    readonly type: string;
    readonly choices: readonly string[];
}

export interface LuraphOptionSpecList {
    readonly [optionName: string]: LuraphOptionSpec;
}

export interface LuraphOptionList {
    [optionName: string]: [boolean, string];
}

export interface LuraphNode {
    readonly cpuUsage: number;
    readonly options: LuraphOptionSpecList;
}

export interface LuraphNodeList {
    readonly [nodeId: string]: LuraphNode;
}

export interface LuraphNodesResponse {
    readonly recommendedId: string;
    readonly nodes: LuraphNodeList;
}

export interface LuraphNewJobResponse {
    readonly jobId: string;
}

export interface LuraphJobStatusResponse {
    readonly success: boolean;
    readonly error?: string;
}

export interface LuraphDownloadResponse {
    readonly fileName: string;
    readonly data: Blob;
}

export interface LuraphError {
    readonly param?: string;
    readonly message: string;
}

export class LuraphException extends Error {
    public readonly errors: LuraphError[];

    constructor(payload: LuraphError[]){
        let errorMsg = payload
            .map(({param, message}) => param ? `${param}: ${message}` : message)
            .join(" | ");

        super(`Luraph API Error: ${errorMsg}`);
        this.name = this.constructor.name;

        this.errors = payload;
    }
}

export class LuraphAPI {
    private readonly baseUrl: string;
    private readonly apiKey: string;

    constructor(apiKey: string) {
        this.baseUrl = "https://api.lura.ph/v1";
        this.apiKey = apiKey;
    }

    // This almost certainly doesn't work on edge hosting - I had to do some hacky changes, will clean up and push them
    private async request(endpoint: string, options: RequestInit = {}): Promise<any> {
        const url = `${this.baseUrl}${endpoint}`;
        const headers = {
            "Luraph-API-Key": this.apiKey,
            ...options.headers
        };

        const response = await fetch(url, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json();
            if (errorData && errorData.errors) {
                throw new LuraphException(errorData.errors);
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        if (options.method === 'GET' && response.headers.get('content-type')?.includes('application/json')) {
            return response.json();
        } else {
            return response.blob();
        }
    }

    async getNodes(): Promise<LuraphNodesResponse> {
        return await this.request("/obfuscate/nodes");
    }

    async createNewJob(node: string, script: string, fileName: string, options: LuraphOptionList): Promise<LuraphNewJobResponse> {
        script = Buffer.from(script).toString("base64");
        const body = JSON.stringify({ node, script, fileName, options });

        return await this.request("/obfuscate/new", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: body
        });
    }

    async getJobStatus(jobId: string): Promise<LuraphJobStatusResponse> {
        return await this.request(`/obfuscate/status/${jobId}`);
    }

    async downloadResult(jobId: string): Promise<LuraphDownloadResponse> {
        const data = await this.request(`/obfuscate/download/${jobId}`);

        // For some reason Cloudflare Pages really, really doesn't like this.
        // const contentDisposition = data.headers.get('Content-Disposition');
        // const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/i.exec(contentDisposition || '');
        // const fileName = matches?.[1].replace(/['"]/g, '');


        // Due to the aforementioned issues, I have just hardcoded fileName here.
        return {
            data,
            fileName: "bundle.lua"
        };
    }
}

export default LuraphAPI;
export const Luraph = LuraphAPI;
export const API = LuraphAPI;
