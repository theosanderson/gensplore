import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// The component embeds Nextclade's WebAssembly aligner; publish its license notices
// with the site that serves it.
const licenses = new URL('../gensplore-component/THIRD_PARTY_LICENSES.txt', import.meta.url)
const thirdPartyLicenses = {
    name: 'third-party-licenses',
    configureServer(server) {
        server.middlewares.use('/THIRD_PARTY_LICENSES.txt', (_request, response) => {
            response.setHeader('Content-Type', 'text/plain; charset=utf-8')
            response.end(readFileSync(licenses))
        })
    },
    generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.txt', source: readFileSync(licenses) })
    },
}

export default defineConfig({
    // depending on your application, base can also be "/"
    base: '',
    plugins: [react(), thirdPartyLicenses],
    resolve: { dedupe: ["react", "react-dom"] },
   define: {
    global: {},
   },

    server: {    
        // this ensures that the browser opens upon server start
        open: true,
        // this sets a default port to 3000  
        port: 3000, 
    },
})