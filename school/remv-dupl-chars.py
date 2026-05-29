string = input("Enter a string: ")
fstring = ""
for char in string:
    if char not in fstring:
        fstring += char
        
print(fstring)