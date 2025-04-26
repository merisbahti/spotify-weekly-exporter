// Copyright 2012 Google LLC
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import http from "http";
import url from "url";
import opn from "open";
import destroyer from "server-destroy";

import { google } from "googleapis";
import { log } from "console";

/**
 * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI.  To get these credentials for your application, visit https://console.cloud.google.com/apis/credentials.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3000";

/**
 * Open an http server to accept the oauth callback. In this simple example, the only request to our webserver is to `/callback?code=<code>`
 */
export async function authenticate(scopes: string[]) {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  );

  /**
   * This is one of the many ways you can configure googleapis to use authentication credentials. In this method, we're setting a global reference for all APIs. Any other API you use here, like `google.drive('v3')`, will now use this auth client. You can also override the auth client at the service and method call levels.
   */
  google.options({ auth: oauth2Client });

  return new Promise<typeof oauth2Client>((resolve, reject) => {
    // grab the url that will be used for authorization
    const authorizeUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes.join(" "),
    });
    const server = http
      .createServer(async (req, res) => {
        try {
          log("got req");
          if (req.url === undefined) {
            throw new Error("req.url is undefined");
          }

          const qs = new url.URL(req.url, "http://localhost:3000").searchParams;
          const code = qs.get("code");
          if (!code) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("No code in query string");
            return;
          }
          res.end("Authentication successful! Please return to the console.");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (server as any).destroy();
          const resp = await oauth2Client.getToken(code);
          log("got token resp", resp);
          oauth2Client.credentials = resp.tokens;
          resolve(oauth2Client);
        } catch (e) {
          reject(e);
        }
      })
      .listen(3000, () => {
        // open the browser to the authorize url to start the workflow
        opn(authorizeUrl, { wait: false }).then((cp) => cp.unref());
      });
    destroyer(server);
  });
}
