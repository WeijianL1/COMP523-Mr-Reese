
### Before you begin

-  Ensure that you have a [Bluemix account](https://console.ng.bluemix.net/registration/). You can register for a 30 days free-trial. 

### Create the services

1. In Bluemix, [create a Conversation Service instance](https://console.ng.bluemix.net/registration/?target=/catalog/services/conversation/).

2. In Bluemix, [create a Discovery Service instance](https://console.ng.bluemix.net/registration/?target=/catalog/services/discovery/).

3. In Bluemix, [create a Natural Language Understanding instance](https://console.bluemix.net/catalog/services/natural-language-understanding)

4. In Bluemix, [create a ClearDB Managed MySQL instance](https://console.bluemix.net/catalog/services/cleardb-managed-mysql-database)

###Set Up Conversation
* Creat a Workspace 
  * ​click on the upload button and choose the conversation_workSpace.json in Data folder
  * ![coversation_1](/Users/apple/Documents/Git/COMP523-Mr-Reese/ReadMe_image/coversation_1.jpeg)

###Set Up Discovery
* Click on "Launch Tool"
* Create two new collections (one for spreadsheet and another for news feed)
  * First click on "create a data collection"
  * Type you collection name 
  * And then click on "Create"
  * ![discovery_1](/Users/apple/Documents/Git/COMP523-Mr-Reese/ReadMe_image/discovery_1.jpeg)
* Click into the spreadsheet collection
* Load data into this collection by clicking "Upload Documents"
* ![discovery_2](/Users/apple/Documents/Git/COMP523-Mr-Reese/ReadMe_image/discovery_2.png)


###Deploy the server code to Bluemix
* Fill out the .env file. 
* 	replicate the .env.example and rename it to .env
* 	
* install cf
* cf login
* manifest
* cf push

