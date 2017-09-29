#!/usr/bin/python
# str(sys.argv[1])).text)

import xlrd, datetime
from docx import Document
from collections import OrderedDict
import simplejson as json
import sys
import re

inFile=str(sys.argv[1])
wb=xlrd.open_workbook(inFile)
sh=wb.sheet_by_name("Sheet1")
document = Document()

for rowx in range(sh.nrows):
	josn_list=[]
	dicto = OrderedDict()
	title=sh.row_values(rowx,0,1)[0]
	# print(title)
	text=sh.row_values(rowx,1,2)[0]
	text=re.sub('\n+',' ',text)
	dicto["title"]=str(title)
	dicto["text"]=str(text)
	josn_list.append(dicto)
	out=json.dumps(josn_list)
	out=out[1:-1]
	# print(out)
	outFile="%s_2.json"%rowx
	f= open(outFile,"w+")
	f.write(out)
