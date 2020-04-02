var aws = require('aws-sdk');
var ses = new aws.SES({region: 'us-east-1'});
var ddb = new aws.DynamoDB({apiVersion: '2012-08-10'});
exports.handler = (event, context, callback) => {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const tokenID = event.Records[0].Sns.MessageId
    var email_message = "";
    var queryParams = {
        ExpressionAttributeValues: {
            ":userid": {"S": message.userID},
            ":current_time":  {"N":(Math.floor(new Date() / 1000)).toString()},
        },
        KeyConditionExpression: "userID = :userid", 
        FilterExpression: "time_to_live > :current_time",
        TableName: 'DynamoTable_Test'
    };
    ddb.query(queryParams, function(err, data) {
        if (err) {
            console.log("Error", err);
            context.fail(err);
        } else {
            if(data.Count !== 0) {
                context.succeed(event);
                return;
            }
            var put_params = {
                TableName: 'DynamoTable_Test',
                Item: {
                    'userID' : {S: message.userID},
                    'token' : {S: tokenID},
                    'time_to_live' : {N: (Math.floor(new Date() / 1000) + 3600).toString()}
            }};
            ddb.putItem(put_params, function(put_err, put_data) {
                if (put_err) {
                    console.log("Error", put_err);
                    context.fail(put_err);
                } else {
                    if(message.billData.length === 0){
                        email_message = `No bills available for the requested period for ${message.userEmail}`
                    }
                    else {
                        email_message = "Links to bills due for the requested period :\n"
                        email_message += JSON.stringify(message.billData, null, 4)
                    }
                    console.log("Success", email_message);
                    var params = {
                        Destination: {
                            ToAddresses: [message.userEmail]
                        },
                        Message: {
                            Body: {
                                Text: { Data: email_message
                                }
                            },
                            Subject: { Data: "[csye6225-spring2020-Assignment_10] Requested Bills"
                            }
                        },
                        Source: "admin@dev.vishakavarma.com"
                    };
                    ses.sendEmail(params, function (err, data) {
                        callback(null, {err: err, data: data});
                        if (err) {
                            console.log(err);
                            context.fail(err);
                        } else {
                            console.log(data);
                            context.succeed(event);
                        }
                    });
                }
            });
        }
    })
};