// === Requirements ======================= //
const fs = require('fs');
require('dotenv').config();
const express = require('express');
const EventEmitter = require('events');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { Client, Intents, MessageEmbed, Collection } = require('discord.js');
const { kofi_channel_id, clientId } = require('./config.json');

const CLIENT_TOKEN = process.env.CLIENT_TOKEN;

// ==========================================================
//            -=[ Client Config ]=-
// ==========================================================

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
        Intents.FLAGS.DIRECT_MESSAGE_REACTIONS,
    ],
});

// ==========================================================
//            -=[ Unhandled Errors ]=-
// ==========================================================

process.on('unhandledRejection', error => console.error('[Uncaught Promise Rejection]:', error));

// ==========================================================
//            -=[ Database Connect ]=-
// ==========================================================

const db = require('./database/database.js');
const kofiTable = require('./database/models/kofiTable.js');

// ==========================================================
//            -=[ Bot Ready Event ]=-
// ==========================================================

client.once("ready", async() => {

    client.user.setActivity('In The Skies', { type: 'PLAYING' });

    db.authenticate().then(() => {
        kofiTable.init(db);

        kofiTable.sync({ force: false });

        console.log('\x1b[31m[Database]: \x1b[32mSuccessfully Logged In');

    }).catch(err => console.log(err));

    console.log(`\x1b[36m[Krowism]: \x1b[32mOnline! Flying in the Skies!`);

});

client.on(`guildCreate`, async (guild) => { 
    client.user.setActivity('In The Skies', { type: 'PLAYING' }),
    console.log(`Joined ${guild.name} with ${guild.id}`);
})

// ==========================================================
//            -=[ Join/Leave Messages ]=-
// ==========================================================

client.on('guildMemberAdd', async member => { 
    const { welcomeChannel, infoChannel, rulesChannel } = require('./config.json');

    if (member == client.user) { 
        return;
    }

   const infoChat = member.guild.channels.cache.get(infoChannel);
   const rulesChat = member.guild.channels.cache.get(rulesChannel);

    const welcomeEmbed = new MessageEmbed()
    .setTitle(`**==[** Welcome to the Nest! **]==**`)
    .setColor('#206694')
    .setDescription(`**-=========================-** \n\n :wave: Welcome ${member}! \n\n **-=========================-** \n\n :book: For our rules, check ${rulesChat} \n\n:mega: Keep up-to-date by checking out${infoChat} \n\n **-=========================-**`)

    let joinChannel = member.guild.channels.cache.get(welcomeChannel);

    if (!joinChannel) { 
        return console.log(`Cannot find or access that channel`);
    } else { 
        if (joinChannel) { 
            joinChannel.send({ embeds: [welcomeEmbed] }).catch(error => { 
                console.log(error)
            });
        }
    }

});

client.on('guildMemberRemove', async member => { 
    const { welcomeChannel } = require('./config.json');

    if (member == client.user) { 
        return;
    }

    const leaveEmbed = new MessageEmbed()
    .setTitle(`**==[** Safe Travels, Friendo! **]==**`)
    .setColor('#E74C3C')
    .setDescription(`**-=========================-** \n\n :wave: Take Care, ${member.user.username}! \n\n **-=========================-**`)

    let leaveChannel = member.guild.channels.cache.get(welcomeChannel);

    if (!leaveChannel) { 
        return console.log(`Cannot find that channel`);
    } else { 
        if (leaveChannel) { 
                leaveChannel.send({ embeds: [leaveEmbed] }).catch(error => { 
             console.log(error)
            });
        }
    }

});

// ==========================================================
//                   -=[ Slash Commands ]=-                 
// ==========================================================

client.commands = new Collection();

const slashCommands = [];
const slashCommandFiles = fs.readdirSync('./slashcommands/').filter(file => file.endsWith('.js'));

for (const file of slashCommandFiles) {
	const command = require(`./slashcommands/${file}`);
	slashCommands.push(command.data.toJSON());
    client.commands.set(command.data.name, command);
}
const rest = new REST({ version: '9' }).setToken(CLIENT_TOKEN);

(async () => {
	try {
		console.log('\x1b[36m[Slash Commands]:\x1b[37m Refreshing Slash Commands...');

		await rest.put(
			Routes.applicationCommands(clientId),
			{ body: slashCommands },
		);

		console.log('\x1b[36m[Slash Commands]:\x1b[37m Slash Commands Loaded: \x1b[32mSuccess');
	} catch (error) {
		console.error(error);
	}
})();

client.on('interactionCreate', async interaction => { 
    if (!interaction.isCommand()) { 
        return
    };

    const command = client.commands.get(interaction.commandName);

    if (!command) { 
        return
    };

    const { options } = interaction

    try { 
        await command.execute(interaction, options, client);
    } catch (error) { 
        console.error(error); 
        await interaction.reply({ content: `There was an error while using this command!`, ephemeral: true})
    }
});


// ==========================================================
//             -=[ Kofi Webhooks ]=-
// ==========================================================

const kofi = express();
kofi.use(express.json());
kofi.use(express.urlencoded({ extended: true }));
kofi.use(express.static('public'));
kofi.disable('x-powered-by');

class KofiWebhook extends EventEmitter {
    listen() {
        kofi.post('/', async (req, res) => {

            if (req.body.data) {
                req.body = JSON.parse(req.body.data);
            };

            var kofiData = req.body;
            var amount = kofiData.amount;
            var timestamp = kofiData.timestamp;
            var senderName = kofiData.from_name;
            var kofiMessage = kofiData.message;
            var isPublic = kofiData.is_public;
            var paymentType = kofiData.type;
            var messageID = kofiData.message_id;
            var paymentID = kofiData.kofi_transaction_id;
            var verifyId = kofiData.verification_token;
            var isSubscription = kofiData.is_subscription_payment;

            const verifyToken = process.env.KOFI_TOKEN

            if (verifyId !== verifyToken) { 
                return res.status(401).end(),
                console.log(`[Ko-Fi Webhook]: An invalid token was provided.`)
            }

            
            if (verifyId === verifyToken) { 

               await kofiTable.create({
                    transactID: kofiData.kofi_transaction_id,
                    senderName: kofiData.from_name,
                    amount: kofiData.amount,
                    kofiMessage: kofiData.message,
                    messageID: kofiData.message_id,
                    paymentType: kofiData.type,
                    isPublic: kofiData.is_public,
                    timestamp: kofiData.timestamp
                });
    
    
                res.status(200).end()
    
                this.emit(
                    'donation',
                    timestamp,
                    amount,
                    senderName,
                    kofiMessage,
                    isPublic,
                    paymentType,
                    paymentID,
                    messageID
                );

                this.emit(
                    'subscription',
                    timestamp,
                    amount,
                    senderName,
                    kofiMessage,
                    isPublic,
                    paymentType,
                    paymentID,
                    messageID,
                    isSubscription
                );

            }

        });

        var port = process.env.PORT || 8080
        kofi.listen(port, '0.0.0.0', () => {
            console.log(`\x1b[34m[Ko-Fi Webhook]:\x1b[32m Online Successfully!`);
        })
    }
}

async function logKofi(timestamp, amount, senderName, kofiMessage, isPublic, paymentType, isSubscription) {
    timestamp = new Date().toLocaleDateString('en-AEST', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });

    let time = new Date().toLocaleTimeString('en-AEST', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    let kofiTime = timestamp + '\n' + time;

    let kofiChannel = client.channels.cache.get(kofi_channel_id);
    
    if (isSubscription === true || paymentType === 'Subscription') { 
        if (kofiMessage == "" && isPublic === true) {

            let noSubMessage = new MessageEmbed() 
            .setColor('RED')
            .addFields(
                { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                { name: ':notepad_spiral: __Message__', value: `[No Message]`, inline: true },
                { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
            )
            .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
            kofiChannel.send({ embeds: [noSubMessage] })
            if (!kofiChannel) { return }

        } else { 

            if (kofiMessage !== "" && isPublic === true) { 

                let withSubMessage = new MessageEmbed() 
                .setColor('RED')
                .addFields(
                    { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                    { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                    { name: ':notepad_spiral: __Message__', value: `${kofiMessage}`, inline: true },
                    { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                    { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                    { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
                )
                .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
                kofiChannel.send({ embeds: [withSubMessage] })
                if (!kofiChannel) { return }

            }
        } 

        if (isPublic !== true) { 
            
            let noPubSub = new MessageEmbed() 
            .setColor('RED')
            .addFields(
                { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                { name: ':notepad_spiral: __Message__', value: `[Private]`, inline: true },
                { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
            )
            .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
            kofiChannel.send({ embeds: [noPubSub] })
            if (!kofiChannel) { return }

        }
    }; 

    if (isSubscription === false || paymentType === 'Donation') { 
        if (kofiMessage == "" && isPublic === true) { 

            let noTipMessage = new MessageEmbed() 
            .setColor('BLUE')
            .addFields(
                { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                { name: ':notepad_spiral: __Message__', value: `[No Message]`, inline: true },
                { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
            )
            .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
            kofiChannel.send({ embeds: [noTipMessage] })
            if (!kofiChannel) { return }

        } else { 
            if (kofiMessage !== "" && isPublic === true) { 

                let withTipMessage = new MessageEmbed() 
                .setColor('BLUE')
                .addFields(
                    { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                    { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                    { name: ':notepad_spiral: __Message__', value: `${kofiMessage}`, inline: true },
                    { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                    { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                    { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
                )
                .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
                kofiChannel.send({ embeds: [withTipMessage] })
                if (!kofiChannel) { return }

            }
        };

        if (isPublic !== true) { 
            let noPubTipMessage = new MessageEmbed() 
            .setColor('BLUE')
            .addFields(
                { name: ':inbox_tray: __Sender Name__', value: `${senderName}`, inline: true },
                { name: ':moneybag: __Amount__', value: `$${amount}`, inline: true },
                { name: ':notepad_spiral: __Message__', value: `[Private]`, inline: true },
                { name: ':timer: __Timestamp__', value: `${kofiTime}`, inline: true },
                { name: ':information_source: __Type__', value: `${paymentType}`, inline: true },
                { name: ':globe_with_meridians: __Source__', value: "[Ko-Fi](https://www.ko-fi.com/krow)", inline: true },
            )
            .setFooter({ text: "Krow's Ko-Fi Webhook", iconURL: "https://uploads-ssl.webflow.com/5c14e387dab576fe667689cf/5cbee341ae2b8813ae072f5b_Ko-fi_logo_RGB_Outline.png"})
            kofiChannel.send({ embeds: [noPubTipMessage] })
            if (!kofiChannel) { return }
        }
    }

}

async function onDonation(timestamp, amount, senderName, kofiMessage, isPublic, messageID, paymentID, paymentType, isSubscription) {
    try {
        await Promise.all([
            logKofi(timestamp, amount, senderName, kofiMessage, isPublic, messageID, paymentID, paymentType, isSubscription),
        ]).catch(error => {
            console.error(`${error}`)
        });
    } catch (error) {
        console.warn('[Ko-Fi Webhook]: Error logging donation');
        console.log(`[Ko-Fi Webhook]: ${error}`);
    }
}

const kofiListener = new KofiWebhook();
kofiListener.listen();
kofiListener.on('donation', onDonation);

// ==========================================================
//             -=[ Bot Login ]=-
// ==========================================================

client.login(CLIENT_TOKEN)
