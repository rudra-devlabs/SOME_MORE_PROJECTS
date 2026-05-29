string = input("Enter a string: ")
vowels = ["a", "e", "i", "o", "u"]
vowNum = 0
for char in string:
    if (char in vowels):
        vowNum += 1

print(f"No. of vowels: {vowNum}")
