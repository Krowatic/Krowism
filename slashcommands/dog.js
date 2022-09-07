const { SlashCommandBuilder } = require('@discordjs/builders');
const fetch = require('node-fetch');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('dog')
		.setDescription('Returns a doggo image'),
		async execute(interaction) {
        await interaction.deferReply();
        const { message } = await fetch('https://dog.ceo/api/breeds/image/random').then(response => response.json());
        interaction.editReply({ files: [message] });

	},
};

