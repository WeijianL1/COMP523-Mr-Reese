
import os
import sys
import datetime
from os.path import join, dirname
from dotenv import load_dotenv
from watson_developer_cloud import DiscoveryV1
import json

def printProgressBar (iteration, total, prefix = '', suffix = '', decimals = 1, length = 100, fill = '█'):
    """
    Call in a loop to create terminal progress bar
    @params:
        iteration   - Required  : current iteration (Int)
        total       - Required  : total iterations (Int)
        prefix      - Optional  : prefix string (Str)
        suffix      - Optional  : suffix string (Str)
        decimals    - Optional  : positive number of decimals in percent complete (Int)
        length      - Optional  : character length of bar (Int)
        fill        - Optional  : bar fill character (Str)
    """
    percent = ("{0:." + str(decimals) + "f}").format(100 * (iteration / float(total)))
    filledLength = int(length * iteration // total)
    bar = fill * filledLength + '-' * (length - filledLength)
    print('\r%s |%s| %s%% %s' % (prefix, bar, percent, suffix), end = '\r')
    # Print New Line on Complete
    if iteration == total: 
        print()

#load .env
dotenv_path = join(dirname(__file__), '.env')
load_dotenv(dotenv_path)

DISCOVERY_USERNAME = os.environ.get("DISCOVERY_USERNAME")
DISCOVERY_PASSWORD= os.environ.get("DISCOVERY_PASSWORD")
ENVIRONMENT_ID= os.environ.get("ENVIRONMENT_ID")
NEWS_COLLECTION_ID= os.environ.get("NEWS_COLLECTION_ID")

#load discovery
discovery = DiscoveryV1(
  username=DISCOVERY_USERNAME,
  password=DISCOVERY_PASSWORD,
  version='2017-11-07'
)
#retrieve all news
# query=""" url:"http://www.starnewsonline.com/foodanddining/20180119/guy-fieri-to-film-in-wilmington?rssfeed=true" """
query=""" url:!"www.starnewsonline" """
# qopts = {'query': query,'count':1000,'offset':1000}
# start_time=datetime.datetime.now()
# my_query = discovery.query(ENVIRONMENT_ID,NEWS_COLLECTION_ID, qopts)
# end_time=datetime.datetime.now()
# print("retrieve done in ",end_time-start_time," s")
# results=my_query["results"]
results=[]
delete_list=[]
dump=""
progress=0

# retrieve news
for x in range(2,4):
	qopts = {'query': query,'count':1000,'offset':1000*x}
	start_time=datetime.datetime.now()
	my_query = discovery.query(ENVIRONMENT_ID,NEWS_COLLECTION_ID, qopts)
	end_time=datetime.datetime.now()
	for res in my_query["results"]:
		results.append(res)
	print(x,"th retrieve done in ",end_time-start_time," s")

# with open("Output.json", "w") as text_file:
#     print(json.dumps(results, indent=2), file=text_file)
    # print(results,file=text_file)

printProgressBar(0, len(results), prefix = 'Progress:', suffix = 'Complete', length = 50)
for result in results:
	result["deleted"]=0

for result in results:
	if result["deleted"]!=1:
		query="""url::"{}" """.format(result["url"])
		# print(query)
		qopts={'query': query,'count':100}
		for_match = discovery.query(ENVIRONMENT_ID,NEWS_COLLECTION_ID, qopts)
		num_match=for_match['matching_results']
		if num_match>1:
			dump+="{} TIMES---TITLE: {} \n".format(num_match,for_match['results'][0]["title"])
			print("{} TIMES---TITLE: {} ".format(num_match,for_match['results'][0]["title"]))
			#delete
			for ind,doc in enumerate(for_match["results"]):
				if ind!=0:
					current_id=doc["id"]
					print(current_id)
					delete_doc = discovery.delete_document(ENVIRONMENT_ID,NEWS_COLLECTION_ID, current_id)
		progress+=1
		printProgressBar(progress, len(results), prefix = 'Progress:', suffix = 'Complete', length = 50)
	





# for result in results:
# 	if(result["deleted"]==0):
# 		current_url=result["url"]
# 		count=0
# 		for to_be_delete in results:
# 			if(count==0 and to_be_delete["url"]==current_url):
# 				count=1
# 			elif(to_be_delete["url"]==current_url and count==1 and to_be_delete["deleted"]==0):
# 				to_be_deleted_id=to_be_delete["id"]
# 				delete_list.append(to_be_deleted_id)
# 				to_be_delete["deleted"]=1

# 				# delete_doc = discovery.delete_document(ENVIRONMENT_ID,NEWS_COLLECTION_ID, to_be_deleted_id)
# 				dump+=(to_be_delete["title"]+"\n")
# 				dump+=(to_be_delete["id"]+"\n")


# for x in delete_list:
# 	delete_doc = discovery.delete_document(ENVIRONMENT_ID,NEWS_COLLECTION_ID, x)
# 	progress+=1
# 	# print(progress," in ",len(delete_list)," Removed")
# 	output="\r{} in {} Removed\n".format(progress,len(delete_list))
# 	sys.stdout.write(output)
# 	sys.stdout.flush()



with open("Output.json", "w") as text_file:
    # print(json.dumps(results, indent=2), file=text_file)
    print(dump,file=text_file)


#traverse, find and delete duplicate using url, mark processed news 
#find invalid html link