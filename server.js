const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const cors = require('cors');
const qrcode = require('qrcode-terminal');

const app = express();
// Configuração do CORS para aceitar requisições de qualquer origem
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        headless: true
    }
});

let isReady = false;
let lastQRCode = null;

// Debug events
client.on('loading_screen', (percent, message) => {
    console.log('LOADING:', percent, message);
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE:', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
    isReady = false;
    // Reinicializa o cliente
    client.initialize();
});

client.on('qr', (qr) => {
    lastQRCode = qr;
    // Gera QR Code no terminal
    qrcode.generate(qr, {small: true});
    console.log('QR Code gerado! Escaneie com o WhatsApp.');
});

client.on('ready', async () => {
    isReady = true;
    console.log('Cliente WhatsApp está pronto!');
    
    try {
        // Lista todos os grupos
        const chats = await client.getChats();
        const grupos = chats.filter(chat => chat.isGroup);
        
        console.log('\n=== LISTA DE GRUPOS ===');
        for(const grupo of grupos) {
            console.log(`\nNome do Grupo: ${grupo.name}`);
            console.log(`ID do Grupo: ${grupo.id._serialized}`);
            console.log(`Participantes: ${grupo.participants.length}`);
            console.log('------------------------');
        }
        
        if(grupos.length === 0) {
            console.log('Nenhum grupo encontrado. Por favor, crie um grupo no WhatsApp.');
        }
    } catch (error) {
        console.error('Erro ao listar grupos:', error);
    }
});

// Rota para verificar status
app.get('/status', (req, res) => {
    res.json({
        isReady,
        hasQR: !!lastQRCode
    });
});

// Rota para obter QR Code
app.get('/qr', (req, res) => {
    if (lastQRCode) {
        res.send(`
            <html>
                <head>
                    <title>WhatsApp QR Code</title>
                    <script src="https://cdn.rawgit.com/davidshimjs/qrcodejs/gh-pages/qrcode.min.js"></script>
                </head>
                <body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f0f2f5;">
                    <div>
                        <div id="qrcode"></div>
                        <p style="text-align: center; margin-top: 20px; font-family: Arial;">Escaneie o QR Code com seu WhatsApp</p>
                    </div>
                    <script>
                        new QRCode(document.getElementById("qrcode"), "${lastQRCode}");
                    </script>
                </body>
            </html>
        `);
    } else {
        res.status(404).json({ error: 'QR Code não disponível' });
    }
});

// Rota para enviar mensagem
app.post('/api/enviar-mensagem', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(500).json({ error: 'Cliente WhatsApp não está pronto' });
        }

        const { mensagem, numeroGrupo } = req.body;
        
        // Envia mensagem para o grupo
        await client.sendMessage(numeroGrupo, mensagem);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ error: 'Erro ao enviar mensagem' });
    }
});

// Inicializa o cliente WhatsApp
client.initialize();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
}); 