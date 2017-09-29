from flask import Flask, render_template,request



app = Flask(__name__)


@app.route('/')
def index():
    return 'hello, test page'


@app.route('/profile/<name>')
def profile(name):
    # this is just a test
    # username=username+ '222'
    # def parse_ni(names):
    #     names=names+username
    #     return names;
    # ni='yoyoyo'
    # name = parse_ni(ni)
    # return '\n\nhey there %s' % name

    return render_template("profile.html",name=name)


from flask import request
from flask import jsonify






@app.route('/json/')
def new_post():
    return render_template('json_trans.html')

@app.route('/create/', methods=['POST'])
def create_post():
    post=request.form['text']

    class Spe(object):
        parent = object
        curr_layer = 0
        inside = 0
        content = ""

        # The class constructor
        def __init__(self, parent, curr_layer, inside, content):
            self.parent = parent
            self.curr_layer = curr_layer
            self.inside = inside
            self.content = content

    def make_spe(parent, curr_layer, inside, content):
        spe = Spe(parent, curr_layer, inside, content)
        return spe

    def remove_duplicates(values):
        output = []
        seen = set()
        for value in values:
            # If value has not been encountered yet,
            # ... add it to both list and set.
            if value not in seen:
                output.append(value)
                seen.add(value)
        return output

    def find_end_layer(string, current):
        b, ini_layer = parse_spe(string, current)
        if current + 1 < len(string):
            first, current = parse_non_spe(string, current + 1);
        if current + 1 < len(string):
            b, l = parse_spe(string, current)
            # need to current+1 since parse_spe not move to next
            while current + 1 < len(string) and l > ini_layer:
                first, current = parse_non_spe(string, current + 1);
                b, l = parse_spe(string, current)
        return string[current];

    def find_number_of_layers(string, current):
        layer_set = [];

        char = find_end_layer(string, current)
        temp = string[1:len(string)]
        while current < len(temp) and temp[current] != char:
            bolean, layer = parse_spe(temp, current)
            if bolean:
                layer_set.append(layer);
            current = current + 1;
        result = remove_duplicates(layer_set)
        return len(result)

    def find_lowest(string, current):
        layer_set = [];
        while current < len(string) and string[current] != "$":
            bolean, layer = parse_spe(string, current)
            if bolean:
                layer_set.append(string[current]);
            current = current + 1;
        result = remove_duplicates(layer_set)
        return len(result)

    def parse_non_spe(string, current):
        first = current;
        while current < len(string) and (string[current] != "#") and (string[current] != "$") and (
            string[current] != "@") and (string[current] != "|") and (string[current] != "*") and (
            string[current] != "!"):
            current = current + 1
        return first, current

    new = "";
    pound_count = 1;

    def parse_spe(string, current):
        if current < len(string):
            if string[current] == "$":
                return True, 1
            elif string[current] == "#":
                return True, 2
            elif string[current] == "!":
                return True, 3
            elif string[current] == "*":
                return True, 4
            elif string[current] == "@":
                return True, 5
            elif string[current] == "|":
                return True, 6
            else:
                return False, -1

    def parse_ref(string, current, new):
        string = string[1:len(string)]
        first, current = parse_non_spe(string, current);
        content = string[first:current]
        content = content.strip()
        new = new + '"' + content + '" : [';
        first, current = parse_non_spe(string, current + 1);
        content = string[first:current]
        content = content.strip()
        count = 0
        while string[current] == "#":
            count = count + 1

            new = new + '"' + str(count) + '. ' + content + '" ,';
            first, current = parse_non_spe(string, current + 1)
            content = string[first:current]
            content = content.strip()
        new = new + '"' + str(count + 1) + '. ' + content + '" ]'
        print new
        return new, current

    def parse_generic(string, current, new):
        string = 'Generic:' + string[1:len(string)]
        while string[current] != ":":
            current = current + 1
        content = string[0:current].strip()


        first, current = parse_non_spe(string, current)
        real_content = string[first + 1:current].strip()
        real_content=real_content.lower()
        new = new + '"' + content + '"' + ': ' + '"' + real_content + '"'
        print new
        return new, current - 7

    def parse_simple(string, current, new):
        string = string[1:len(string)]
        while string[current] != ":":
            current = current + 1
        content = string[1:current].strip()
        if content == 'Mnemonic' or content == 'MNEMONIC':
            content = 'Hint'
        first, current = parse_non_spe(string, current)
        real_content = string[first + 1:current].strip()
        new = new + '"' + content + '"' + ': ' + '"' + real_content + '"'
        print new
        return new, current + 1

    def multi_input():
        try:
            while True:
                data = raw_input()
                if not data: break
                yield data
        except KeyboardInterrupt:
            return

    def set_object(string):
        # transfer to objects,put them into an array.
        spe_list = [];
        temp_list = [None] * 5;
        current = 0;

        b, layer = parse_spe(long_str, current)
        first, current = parse_non_spe(long_str, 1);
        inside = find_number_of_layers(long_str, 0)
        real_root = make_spe('root', 0, 100, 'this is real root')
        root = make_spe(real_root, layer, inside, long_str[first:current].strip())
        spe_list.append(root)
        temp_list[layer - 1] = root;

        while long_str[current] != "$":
            b, layer = parse_spe(long_str, current)
            inside = find_number_of_layers(long_str, current)

            first, current = parse_non_spe(long_str, current + 1)
            obj = make_spe(temp_list[layer - 2], layer, inside, long_str[first:current].strip())
            spe_list.append(obj)
            if layer != 6:
                temp_list[layer - 1] = obj

        return spe_list, current;

    def parse_reno(set, current, new):
        last_obj = make_spe(-1, -1, -1, -1)
        current_parent = [None] * 5
        # current_parent[0]=set[0].parent
        pos = 0
        # obj = set[pos]

        while pos < len(set):
            obj = set[pos]
            if obj.inside == 1:

                if last_obj.curr_layer - obj.curr_layer > 0:
                    parenthesis = last_obj.curr_layer - obj.curr_layer

                    while parenthesis > 0:
                        new = new + '}'
                        parenthesis = parenthesis - 1

                ##add comma if had peer before
                if current_parent[obj.curr_layer - 2] == obj.parent:
                    new = new + ','
                else:
                    current_parent[obj.curr_layer - 2] = obj.parent
                new = new + '"' + obj.content + '"' + ': ['
                # current_parent[obj.curr_layer-1]=obj;
                pos_arr = pos + 1;

                while pos_arr < len(set):
                    if set[pos_arr].inside == 0 and set[pos_arr].parent == obj:
                        new = new + '"' + set[pos_arr].content + '",'
                        pos_arr = pos_arr + 1
                    else:
                        pos_arr = pos_arr + 1

                new_list = list(new)
                new_list[len(new_list) - 1] = ']'
                new = "".join(new_list)
                # pos=pos_arr
                last_obj = obj
            elif obj.inside == 0 and obj.parent.inside > 1:

                if last_obj.curr_layer - obj.curr_layer > 0:
                    parenthesis = last_obj.curr_layer - obj.curr_layer
                    while parenthesis > 0:
                        new = new + '}'
                        parenthesis = parenthesis - 1

                if current_parent[obj.curr_layer - 2] == obj.parent:
                    new = new + ","
                else:
                    current_parent[obj.curr_layer - 2] = obj.parent
                new = new + '"' + obj.content + '" : false'
                last_obj = obj
                # pos=pos+1
            elif obj.inside > 1:

                ##check for closing parenthesis
                if last_obj.curr_layer - obj.curr_layer > 0:
                    parenthesis = last_obj.curr_layer - obj.curr_layer

                    while parenthesis > 0:
                        new = new + '}'
                        parenthesis = parenthesis - 1


                        ##check peer for comma
                if current_parent[obj.curr_layer - 2] == obj.parent:
                    new = new + ','
                else:
                    current_parent[obj.curr_layer - 2] = obj.parent

                new = new + '"' + obj.content + '"' + ':{'
                last_obj = obj
                # pos=pos+1
            pos = pos + 1
            ##check for closing parenthesis
        if last_obj.curr_layer - 1 > 0:
            parenthesis = last_obj.curr_layer - 1

            while parenthesis > 0:
                new = new + '}'
                parenthesis = parenthesis - 1
        print new;
        return new

    # userInput = list(multi_input())
    # long_str = ""
    # for each in userInput:
    #     long_str = long_str + each

    tmp=post
    cursor = 0;
    l=list(tmp)
    while cursor < len(l):
        if l[cursor]==".":
            l[cursor]="_"
        cursor=cursor+1
    long_str=''.join(l)
    long_str = long_str + '$'
    from pprint import pprint

    # for each in spe_list:
    # pprint(vars(each))
    # print len(spe_list)

    # generic
    generic, current = parse_generic(long_str, 0, new)
    # hint
    long_str = long_str[current:len(long_str)]
    simple, current = parse_simple(long_str, 0, new)

    last_obj = ''
    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    clas = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    brand = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    indication = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    renal = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    hepatic = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    side = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    mecha = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    spe_list, current = set_object(long_str)
    black = parse_reno(spe_list, 0, new)

    long_str = long_str[current:len(long_str)]
    ref, current = parse_ref(long_str, 0, new)

    #
    json = generic + ',' + simple + ',' + clas + ',' + brand + ',' + indication \
           + ',' + renal + ',' + hepatic + ',' + side + ',' + mecha + ',' + black + ',' + ref;
    return '<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">'\
    '<link rel="stylesheet" type="text/css" href="/static/style.css">'\
           "<span style='color:green;font-weight:bold'>CORRECT!</span> COPY PASTE EVERYTHING BELOW: <br> <br>" \
           "<a href='/json/' class='w3-btn w3-black' >back</a>" \
           "<br>"+json





if __name__ == "__main__":
    app.run(host='0.0.0.0',port=9999,threaded=True)
