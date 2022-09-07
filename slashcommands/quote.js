const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('quote')
		.setDescription('Returns a quote'),
	  async execute(interaction) {
    		async function getQuote() {
            return fetch("https://zenquotes.io/api/random")
              .then(res => {
                return res.json()
                })
              .then(data => {
                return data[0]["q"] + " -" + data[0]["a"]
            }).catch(error => { 
                console.log(error)
            })
        };
        
		await interaction.deferReply();
    getQuote().then(quote => interaction.editReply({ content: quote}))

	},
};

