string = input("Enter a string: ")
dig, uc, lc = 0,0,0
for char in string:
    if (char.isdigit()):
        dig += 1
    if (char.isalpha()):
        if (char.isupper):
            uc += 1
        if (char.islower()):
            lc += 1
            
print("Digits: ", dig)
print("Upper Case: ", uc)
print("Lower Case: ", lc)
    