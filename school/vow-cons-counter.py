string = input("Enter the string: ")
vowNum = 0
conNum = 0
vowels = ["a", "i", "o", "u", "e"]
for char in string:
    if (char.isalpha()):
        if (char in vowels):
            vowNum += 1
        else:
            conNum += 1

print("Number of vowels: ",vowNum)
print("Number of consonants: ",conNum)