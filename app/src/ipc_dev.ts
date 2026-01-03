import { createInterface } from "node:readline";
import { readFileSync } from "node:fs";
import { normalize } from "node:path";
import { render } from "./markdownit.ts";

/**
 * Handle stdin and send messages via WebSocket.
 *
 * @param socket WebSocket instance.
 */
export default async function (socket: WebSocket): Promise<void> {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();

	// readline for stdin
	const rl = createInterface({
		input: process.stdin,
		crlfDelay: Infinity, // поддержка \r\n
	});

	for await (const line of rl) {
		// string format action:arg1,arg2,...
		const [action, ...args] = line.split(":");

		switch (action) {
			case "show": {
				try {
					// read file from arg[0]
					const raw = readFileSync(args[0]);
					const content = decoder.decode(raw);

					socket.send(
						encoder.encode(
							JSON.stringify({
								action,
								html: render(content),
								lcount: (content.match(/(?:\r?\n)/g) || []).length + 1,
							}),
						),
					);
				} catch (err) {
					console.error("Reading file error:", err);
				}
				break
			}

			case "scroll": {
				socket.send(
					encoder.encode(
						JSON.stringify({
							action,
							line: args[0],
						}),
					),
				);
				break;
			}

			case "base": {
				socket.send(
					encoder.encode(
						JSON.stringify({
							action,
							base: normalize(args[0] + "/"),
						}),
					),
				);
				break;
			}

			default:
				break;
		}
	}
}
