string = input("Enter a string: ")
wordList = string.split()
reverse = ""
for word in wordList:
    rev = word[::-1]
    reverse += rev+" "
    
print("Reversed string: ", reverse)