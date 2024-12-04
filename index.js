import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import input from 'input'
import axios from 'axios'
import * as cheerio from 'cheerio';
import { GROUP_NAME, MAX_GROUPS, botUsername, GROUP_ABOUT, COMMAND } from './config.js'

let phone = ''

const BANNER = `
\x1b[38;5;51m╔══════════════════════════════════════════════════════════╗
║                          \x1b[38;5;199mVersion 1.0.0\x1b[38;5;51m                   ║
║                          \x1b[38;5;199m⚡ 2024 ⚡\x1b[38;5;51m                      ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║            \x1b[38;5;227m████████╗ ██████╗  ██████╗ ██╗  ██╗\x1b[38;5;51m           ║
║            \x1b[38;5;227m╚══██╔══╝██╔════╝ ██╔════╝ ██║ ██╔╝\x1b[38;5;51m           ║
║            \x1b[38;5;227m   ██║   ██║  ███╗██║  ███╗█████╔╝\x1b[38;5;51m            ║
║            \x1b[38;5;227m   ██║   ██║   ██║██║   ██║██╔═██╗\x1b[38;5;51m            ║
║            \x1b[38;5;227m   ██║   ╚██████╔╝╚██████╔╝██║  ██╗\x1b[38;5;51m           ║
║            \x1b[38;5;227m   ╚═╝    ╚═════╝  ╚═════╝ ╚═╝  ╚═╝\x1b[38;5;51m           ║
║                                                          ║
╠══════════════════════════════════════════════════════════╣
║     \x1b[38;5;199m⚡ Telegram Group Generator Kit \x1b[38;5;51m|\x1b[38;5;199m Made with 💖 ⚡    \x1b[38;5;51m║
║              \x1b[38;5;199m✦ Created by @MACTEP_MNPL ✦\x1b[38;5;51m                 ║
╚══════════════════════════════════════════════════════════╝\x1b[0m`

async function getApiCredentials() {
    console.log(BANNER)
    console.log('First we have to get API hash and API id of your telegram account\n')

    phone = await input.text('Enter your number with country code (e.g., +1234567890): ')
    
    try {
        // Create session
        const session = axios.create()
        
        // Send password request
        const sendPasswordResponse = await session.post('https://my.telegram.org/auth/send_password', 
            new URLSearchParams({ phone }))
        
        const { random_hash } = sendPasswordResponse.data
        
        if (sendPasswordResponse.data.error) {
            throw new Error(sendPasswordResponse.data.error)
        }

        // Get verification code from user
        const code = await input.text('Enter the code sent to your Telegram account: ')
        
        // Login
        const loginResponse = await session.post('https://my.telegram.org/auth/login',
            new URLSearchParams({
                phone,
                random_hash,
                password: code
            })
        )

        // After login response
        const cookie = loginResponse.headers['set-cookie'][0]

        // Get apps page with proper cookie
        const appsResponse = await session.get('https://my.telegram.org/apps', {
            headers: {
                Cookie: cookie
            }
        })

        // Load the HTML into cheerio
        const $ = cheerio.load(appsResponse.data)

        // If we get redirected to create app page, let's create one
        if (appsResponse.data.includes('Create new application')) {
            // Get the hash from the create form
            const createHash = $('input[name="hash"]').val()
            
            // Create new app
            await session.post('https://my.telegram.org/apps/create',
                new URLSearchParams({
                    hash: createHash,
                    app_title: 'Telegram Group Generator Kit',
                    app_shortname: 'tgkit',
                    app_url: 'https://t.me/monetazone_bot',
                    app_platform: 'android',
                    app_desc: 'Telegram Group Generator Kit'
                }), {
                    headers: {
                        Cookie: cookie
                    }
                })

            // Now get the apps page again to see our credentials
            const finalResponse = await session.get('https://my.telegram.org/apps', {
                headers: {
                    Cookie: cookie
                }
            })
            
            const $final = cheerio.load(finalResponse.data)
            return {
                apiId: $final('span.form-control strong').first().text().trim(),
                apiHash: $final('span.form-control').eq(1).text().trim()
            }
        }

        // If we're already on the apps page, extract credentials
        const apiId = $('span.form-control strong').first().text().trim()
        const apiHash = $('span.form-control').eq(1).text().trim()

        return {
            apiId,
            apiHash
        }
    } catch (error) {
        console.error('Error getting API credentials:', error.message)
        throw error
    }
}

async function createGroups(apiId, apiHash) {
    console.log('Starting group creation process...')
    
    const session = new StringSession('')
    const client = new TelegramClient(session, apiId, apiHash, {
        connectionRetries: 5,
    })

    // Login
    await client.start({
        phoneNumber: phone,
        password: async () => await input.text('Password: '),
        phoneCode: async () => await input.text('Phone code: '),
        onError: (err) => console.log(err),
    })

    console.log('Login successful!')

    // Resolve bot username to get the user entity
    let botUser;
    try {
        // Get bot user ID without @ symbol
        const botUserName = botUsername.replace('@', '');
        botUser = await client.getEntity(botUserName);
        console.log('Bot entity resolved successfully');
        console.log('Bot ID:', botUser.id);
    } catch (error) {
        console.error('Error resolving bot username:', error);
        return;
    }

    try {
        // Create groups
        for (let i = 0; i < MAX_GROUPS; i++) {
            try {
                console.log(`Creating group ${i + 1}/${MAX_GROUPS}`);

                const result = await client.invoke(new Api.channels.CreateChannel({
                    title: String(GROUP_NAME),
                    about: GROUP_ABOUT,
                    megagroup: true,
                    broadcast: false
                }));

                console.log(`Group ${i + 1} created with ID:`, result.chats[0].id);

                try {
                    // Create InputUser object for the bot
                    const inputBot = new Api.InputUser({
                        userId: BigInt(botUser.id.value),
                        accessHash: BigInt(botUser.accessHash.value)
                    });

                    // Add bot to channel
                    await client.invoke(new Api.channels.InviteToChannel({
                        channel: result.chats[0],
                        users: [inputBot]
                    }));

                    // Make bot admin
                    await client.invoke(new Api.channels.EditAdmin({
                        channel: result.chats[0],
                        userId: inputBot,
                        adminRights: new Api.ChatAdminRights({
                            changeInfo: true,
                            postMessages: true,
                            editMessages: true,
                            deleteMessages: true,
                            banUsers: true,
                            inviteUsers: true,
                            pinMessages: true,
                            addAdmins: false,
                            anonymous: false,
                            manageCall: true,
                            other: true,
                        }),
                        rank: "помощник"
                    }));

                    console.log(`Bot added as admin to group ${i + 1}`);

                    // Increase delay before sending command
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    // Send /new command
                    await client.sendMessage(result.chats[0], {
                        message: COMMAND
                    });
                    console.log(`Sent /new command to group ${i + 1}`);

                } catch (error) {
                    console.error(`Error managing bot in group ${i + 1}:`, error);
                }

                // Add delay between creations
                if (i < MAX_GROUPS - 1) {
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

            } catch (error) {
                console.error(`Error creating group ${i + 1}:`, error);
            }
        }
    } catch (error) {
        console.error('Error in group creation:', error);
    }

    await client.disconnect()
    console.log('Finished creating groups!')
}

// Main execution
async function main() {
    try {
        const credentials = await getApiCredentials()
        console.log('\nAPI Credentials obtained successfully:')
        console.log(`API ID: ${credentials.apiId}`)
        console.log(`API Hash: ${credentials.apiHash}\n`)

        await createGroups(parseInt(credentials.apiId), credentials.apiHash)
    } catch (error) {
        console.error('Error in main execution:', error)
    }
}

// Error handling
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error)
})

// Run the script
main().catch(console.error)