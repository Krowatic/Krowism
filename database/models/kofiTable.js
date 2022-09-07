const { DataTypes, Model } = require('sequelize');

module.exports = class kofiTable extends Model {
    static init(sequelize){
        return super.init({
            kofiID: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                allowNull: false,
                primaryKey: true
            },
            
            senderName: { 
                type: DataTypes.STRING, 
                allowNull: false 
            },
            
            amount: {
                type: DataTypes.DECIMAL, 
                allowNull: false
            },
            
            kofiMessage: { 
                type: DataTypes.TEXT, 
                allowNull: false
            },
            
            transactID: {
                type: DataTypes.INTEGER, 
                allowNull: false
            },
            
            messageID: {
                type: DataTypes.INTEGER, 
                allowNull: false
            },
            
            paymentType: { 
                type: DataTypes.STRING, 
                allowNull: false
            },
            
            isPublic: { 
                type: DataTypes.INTEGER, 
                allowNull: false
            },
        }, {
            tableName: 'kofiTable',
            timestamps: false,
            sequelize
        });
    }
}